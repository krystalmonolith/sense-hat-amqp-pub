const rabbitmq_host = 'ap1000';

const amqp = require('amqplib');
const fs = require('fs');

fs.readFile('tls/userpass', 'utf8', function(err, contents) {
    if (err) {
      console.error("Unable to read \'password\' file! ... " + err);
      process.exit();
    }
    var userpass = contents.replace(/^\s+|\s+$/g, '');
    send(rabbitmq_host, userpass);
});


function send(host,userpass) {
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
      var msg = 'Hello World!';
   
      var ok = ch.assertQueue(q, {durable: false});
   
      return ok.then(function(_qok) {
        // NB: `sentToQueue` and `publish` both return a boolean
        // indicating whether it's OK to send again straight away, or
        // (when `false`) that you should wait for the event `'drain'`
        // to fire before writing again. We're just doing the one write,
        // so we'll ignore it.
        ch.sendToQueue(q, Buffer.from(msg));
        console.log(" [x] Sent '%s'", msg);
        return ch.close();
      });
    }).finally(function() { conn.close(); });
  }).catch(console.warn);
}
