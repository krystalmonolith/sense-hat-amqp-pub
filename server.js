const rabbitmq_host = 'ap1000';

const amqp = require('amqplib');
const fs = require('fs');
const uuidv4 = require('uuid/v4');

const { Observable, timer } = require('rxjs');

fs.readFile('tls/userpass', 'utf8', function(err, contents) {
    if (err) {
      console.error("Unable to read \'password\' file! ... " + err);
      process.exit();
    }
    var userpass = contents.replace(/^\s+|\s+$/g, '');
    const sessionId = uuidv4();
    send(rabbitmq_host, userpass, sessionId);
});


function send(host,userpass, sessionId) {
  const auth = encodeURIComponent(userpass);
  const url = 'amqps://' + auth + '@' + host;
  var opts = {
    cert: fs.readFileSync('tls/client_certificate.pem'),
    key: fs.readFileSync('tls/client_key.pem'),
    ca: [fs.readFileSync('tls/ca_certificate.pem')]
  };
  amqp.connect(url, opts).then(function(conn) {
    return conn.createChannel().then(function(ch) {
      var q = 'hello';
      var qp = ch.assertQueue(q, {durable: false});
      return qp.then(function(qstate) {
        console.log(qstate);
        const subscription = timer(0,1000).subscribe((msgnum) => {
          const msg = {
             'id': sessionId,
             'mn': msgnum,
             'ts': Date.now() / 1000
          };
          const msgJson = JSON.stringify(msg);
          ch.sendToQueue(q, Buffer.from(msgJson));
          console.log(msgJson);
        });
        process.on('SIGINT', () => {
          console.log('\nSIGINT!');
          subscription.unsubscribe();
          ch.close();
          conn.close();
        });
      }); // qp.then
    });
  }).catch(console.warn);
}
