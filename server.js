const VERSION      = '1.0.0';
const PROGRAM_NAME = 'sense-hat-amqp-pub';

const DEF_HOST   = 'localhost:15672';
const DEF_PERIOD = 100;
const DEF_QUEUE  = 'sensehat/1/0/0';

const DEF_USERPASS        = 'tls/userpass';
const DEF_TLS_CLIENT_CERT = 'tls/client_certificate.pem';
const DEF_TLS_CLIENT_KEY  = 'tls/client_key.pem';
const DEF_TLS_CA_CERTS    = 'tls/ca_certificate.pem';


require('dotenv').config()

const fs = require('fs');
const os = require('os');

const amqp = require('amqplib');
const uuidv4 = require('uuid/v4');
const { Observable, timer } = require('rxjs');
const imu = require("node-sense-hat").Imu;

function getFile(f, errmsg) {
  try {
    return fs.readFileSync(f).toString();
  } catch (e) {
    console.error(errmsg, e);
    process.exit();
  }
}

function imuMessageService(sessionid, period, subCallback) {
  const IMU = new imu.IMU();
  return Observable.create((observer) => {
    console.log("TIMER PERIOD: %d msec", period);
    const timerSubscription = timer(0,period).subscribe((msgnum) => {
      IMU.getValue((err, data) => {
        if (err !== null) {
          console.error("Could not read sensor data: ", err);
          return;
        }
        data.mn = msgnum;
        data.id = sessionid;
        data.host = os.hostname();
        observer.next(data);
      }); 
    });
    subCallback(timerSubscription);
  });
}

function send(host, period, queue, sessionid, hostname, userpass, tlsopts) {
  const auth = encodeURIComponent(userpass);
  const url = 'amqps://' + auth + '@' + host;
  amqp.connect(url, tlsopts).then((conn) => {
    return conn.createChannel().then((ch) => {
      const qp = ch.assertQueue(queue, {durable: false});
      return qp.then((qstate) => {
        console.log(qstate);
        var timerSubscription;
        imuMessageService(sessionid, period, (ts) => { timerSubscription = ts; })
        .subscribe(data => {
          const msgJson = JSON.stringify(data);
          ch.sendToQueue(queue, Buffer.from(msgJson));
          console.debug(msgJson);
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
  const host    = process.argv[2] || process.env.HOST   || DEF_HOST;
  const period  = process.argv[3] || process.env.PERIOD || DEF_PERIOD;
  const queue   = process.argv[4] || process.env.QUEUE  || DEF_QUEUE;

  const hostname     = os.hostname();

  const userpass_file   = process.env.USERPASS        || DEF_USERPASS;
  const tls_client_cert = process.env.TLS_CLIENT_CERT || DEF_TLS_CLIENT_CERT;
  const tls_client_key  = process.env.TLS_CLIENT_KEY  || DEF_TLS_CLIENT_KEY;
  const tls_ca_certs    = process.env.TLS_CA_CERTS    || DEF_TLS_CA_CERTS;

  const sessionid = uuidv4();

  const userpass = getFile(userpass_file, 'Unable to read username:password from file \'' + userpass_file + '\': %s')
                   .replace(/^\s+|\s+$/g, '');

  const tlsopts = {
    cert: getFile(tls_client_cert, 'Unable to read TLS_CLIENT_CERT: %s'),
    key: getFile(tls_client_key, 'Unable to read TLS_CLIENT_KEY: %s'),
    ca: [getFile(tls_ca_certs, 'Unable to read TLS_CA_CERTS: %s')]
  };

  try {
    console.info("%s v%s: Started at %s (Node.js %s) [%d]", PROGRAM_NAME, VERSION, new Date().toISOString(), process.version, process.pid);
    console.info("%s %s %s %s", os.hostname(), os.type(), os.arch(), os.release());
    send(host, period, queue, sessionid, hostname, userpass, tlsopts);
  } catch (serr) {
    console.error('SEND ERROR: %s', serr);
  }
}

main();
