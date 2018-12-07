const queueName = 'hello';
const rabbitmq_host = 'ap1000';
const UPDATE_RATE_MSEC = process.argv[2] || 100;

const PROGRAM_NAME = process.argv[1].replace(/^\/.*\//,'');

const fs = require('fs');
const os = require('os');

const amqp = require('amqplib');
const uuidv4 = require('uuid/v4');
const { Observable, timer } = require('rxjs');
const imu = require("node-sense-hat").Imu;

const IMU = new imu.IMU();

function imuMessageService(sessionId, period, subCallback) {
  return Observable.create((observer) => {
    console.log("TIMER PERIOD: %d msec", period);
    const timerSubscription = timer(0,period).subscribe((msgnum) => {
      IMU.getValue((err, data) => {
        if (err !== null) {
          console.error("Could not read sensor data: ", err);
          return;
        }
        data.mn = msgnum;
        data.id = sessionId;
        data.host = os.hostname();

        delete data.humidity;
        delete data.temperature;
        observer.next(data);
      }); 
    });
    subCallback(timerSubscription);
  });
}

function send(host,userpass, sessionId) {
  const auth = encodeURIComponent(userpass);
  const url = 'amqps://' + auth + '@' + host;
  const opts = {
    cert: fs.readFileSync('tls/client_certificate.pem'),
    key: fs.readFileSync('tls/client_key.pem'),
    ca: [fs.readFileSync('tls/ca_certificate.pem')]
  };
  amqp.connect(url, opts).then((conn) => {
    return conn.createChannel().then((ch) => {
      const qp = ch.assertQueue(queueName, {durable: false});
      return qp.then((qstate) => {
        console.log(qstate);
        var timerSubscription;
        imuMessageService(sessionId, UPDATE_RATE_MSEC, (ts) => { timerSubscription = ts; })
        .subscribe(data => {
          const msgJson = JSON.stringify(data);
          ch.sendToQueue(queueName, Buffer.from(msgJson));
          console.log(msgJson);
        });
        process.on('SIGINT', () => {
          console.log('\n' + PROGRAM_NAME + ' Exiting!');
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
  fs.readFile('tls/userpass', 'utf8', (err, contents) => {
    if (err) {
      console.error("Unable to read \'tls/userpass\' file! ... " + err);
      process.exit();
    }
    const userpass = contents.replace(/^\s+|\s+$/g, '');
    const sessionId = uuidv4();
    send(rabbitmq_host, userpass, sessionId);
  });
}

main();
