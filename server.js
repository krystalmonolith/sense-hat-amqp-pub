const VERSION      = '1.2.0';
const PROGRAM_NAME = 'sense-hat-amqp-pub';

//-----------------------------------------------------------------------------
// .env File Parameters
const DEF_HOST   = 'localhost';    // RabbitMQ Hostname/IP Address
const DEF_QUEUE  = 'sensehat/imu'; // RabbitMQ queue name

const DEF_USERPASS        = 'tls/userpass'; // RabbitMQ username:password
const DEF_TLS_CLIENT_CERT = 'tls/client_certificate.pem'; // TLS Client Certificate
const DEF_TLS_CLIENT_KEY  = 'tls/client_key.pem';         // TLS Client Key
const DEF_TLS_CA_CERTS    = 'tls/ca_certificate.pem';     // CA Certificate(s)

const DEF_PERIOD     = 100; // Update Period in Milliseconds

//-----------------------------------------------------------------------------
// Load .env File
require('dotenv').config();

//-----------------------------------------------------------------------------
// Load command line parameters.
const args = require('yargs').argv;

//-----------------------------------------------------------------------------
// Initialize debug boolean that controls logging of JSON published to RabbitMQ. 
const DEBUG_AMQP_JSON = process.env.DEBUG_AMQP_JSON && process.env.DEBUG_AMQP_JSON !== 'false';

const fs = require('fs');
const os = require('os');
const util = require('util');

const amqp = require('amqplib');
const uuidv4 = require('uuid/v4');
const { Observable, timer } = require('rxjs');
const imu = require("node-sense-hat").Imu;

/** Synchronous file read with fatal error try/catch logger.
* @param f - The file path to read.
* @param errmsg - The error message to log when an exception occurs.
* Should have a '%s' where the exception error message should be substituted.
* @returns The contents of the file as a String.
*/
function getFile(f, errmsg) {
  try {
    return fs.readFileSync(f).toString();
  } catch (e) {
    console.error(errmsg, e);
    process.exit();
  }
}

/** Returns an Observable that publishes IMU state message objects every <period> milliseconds.
* @param sessionid - Session ID (UUID) to differentiate data collection sessions.
* @param hostname - Hostname used to differentiate data collection points.
* @param period - The sample period  in milliseconds.
* @param subCallback - A callback that should store the sample timer subscription that is
* used at program exit to cancel the sampling timer.
* @return An Observable publishing IMU state message objects every <period> milliseconds.
*/ 
function imuMessageService(sessionid, hostname, period, subCallback) {
  const IMU = new imu.IMU();
  return Observable.create((observer) => {
    console.log("imu sample period: %d msec", period);
    const timerSubscription = timer(0,period).subscribe((msgnum) => {
      IMU.getValue((err, data) => {
        if (err !== null) {
          console.error("Could not read sensor data: ", err);
          return;
        }
        data.mn = msgnum;
        data.id = sessionid;
        data.host = hostname;
        try {
          observer.next(data);
        } catch (e) {
          if (!(e instanceof IllegalOperationError)) {
            throw e;
          }
        }
      }); 
    });
    subCallback(timerSubscription);
  });
}

/** Connects to the RabbitMQ server and publishes the IMU messages generated by imuMessageService.
* @param host - RabbitMQ hostname or IP Address.
* @param period - The sample period  in milliseconds.
* @param queue - RabbitMQ queue name.
* @param sessionid - Session ID (UUID) to differentiate data collection sessions.
* @param hostname - Hostname used to differentiate data collection points.
* @param userpass - The RabbitMQ "username:password" string.
* @param tlsopts -The HTTPS TLS options object containing the TLS client cert, client key, and CA certificate.
*/ 
function send(host, period, queue, sessionid, hostname, userpass, tlsopts) {
  const auth = encodeURIComponent(userpass);
  var url = 'amqps://' + auth + '@' + host;
  amqp.connect(url, tlsopts).then((conn) => {
     url = undefined;
    return conn.createChannel().then((ch) => {
      const qp = ch.assertQueue(queue, {durable: false});
      return qp.then((qstate) => {
        console.log(qstate);
        var timerSubscription;
        var exponent = 0;
        imuMessageService(sessionid, hostname, period, (ts) => { timerSubscription = ts; })
        .subscribe(data => {
          const msgJson = JSON.stringify(data);
          ch.sendToQueue(queue, Buffer.from(msgJson));
          if (DEBUG_AMQP_JSON) {
            console.log(msgJson);
          }
          if ((1 << exponent) == data.mn) {
            exponent++;
            console.log('%s: %d messages published to queue %s.', new Date().toISOString(), data.mn, queue);
          }
        });
        process.on('SIGINT', () => {
          console.info("\n%s v%s: Exiting at %s", PROGRAM_NAME, VERSION, new Date().toISOString());
          if (timerSubscription) { 
            timerSubscription.unsubscribe();
          }
          ch.close();
          conn.close();
        });
      }); // qp.then
    });
  }).catch(console.warn);
}

function main() {
  const host      = args.host      || process.env.HOST      || DEF_HOST;
  const period    = args.period    || process.env.PERIOD    || DEF_PERIOD;
  const queue     = args.queue     || process.env.QUEUE     || DEF_QUEUE;
  const sessionid = args.sessionid || process.env.SESSIONID || uuidv4();
  const hostname  = args.hostname  || process.env.HOSTNAME  || os.hostname();

  const userpass_file   = args.userpass        || process.env.USERPASS        || DEF_USERPASS;
  const tls_client_cert = args.tls_client_cert || process.env.TLS_CLIENT_CERT || DEF_TLS_CLIENT_CERT;
  const tls_client_key  = args.tls_client_key  || process.env.TLS_CLIENT_KEY  || DEF_TLS_CLIENT_KEY;
  const tls_ca_certs    = args.tls_ca_certs    || process.env.TLS_CA_CERTS    || DEF_TLS_CA_CERTS;


  const userpass = getFile(userpass_file, 'Unable to read username:password from file \'' + userpass_file + '\': %s')
                   .replace(/^\s+|\s+$/g, ''); // Read and remove line ending characters.

  const tlsopts = {
    cert: getFile(tls_client_cert, util.format('Unable to read TLS_CLIENT_CERT[%s]: %%s', tls_client_cert)),
    key: getFile(tls_client_key, util.format('Unable to read TLS_CLIENT_KEY[%s]: %%s', tls_client_key)),
    ca: [getFile(tls_ca_certs, util.format('Unable to read TLS_CA_CERTS[%s]: %%s', tls_ca_certs))]
  };

  try {
    console.info("%s v%s: Started at %s (Node.js %s) [%d]", PROGRAM_NAME, VERSION, new Date().toISOString(), process.version, process.pid);
    console.info("%s %s %s %s", os.hostname(), os.type(), os.arch(), os.release());
    send(host, period, queue, sessionid, hostname, userpass, tlsopts);
  } catch (serr) {
    console.error('SEND ERROR:\n%s', serr);
    throw serr;
  }
}

main();
