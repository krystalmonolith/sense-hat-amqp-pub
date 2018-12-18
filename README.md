# sense-hat-amqp-pub

A Node.js daemon for publishing the output of a 
[Raspberry Pi](https://www.raspberrypi.org/) 
[Sense Hat](https://www.raspberrypi.org/products/sense-hat/) 
[Inertial Measurement Unit (IMU)](https://en.wikipedia.org/wiki/Inertial_measurement_unit)
to a [RabbitMQ](https://www.rabbitmq.com/)
[AMQP](https://en.wikipedia.org/wiki/Advanced_Message_Queuing_Protocol) Server.

## Example Published [JSON](http://json.org) Message

```json
{
    "accel": {
        "x": -0.03647158667445183,
        "y": 0.004005844704806805,
        "z": 0.6671451330184937
    },
    "compass": {
        "x": -1.4884382486343384,
        "y": 3.8715322017669678,
        "z": 8.953288078308105
    },
    "fusionPose": {
        "x": 0.006004385184496641,
        "y": 0.05461280047893524,
        "z": -1.8260560035705566
    },
    "gyro": {
        "x": 0.001355886459350586,
        "y": -0.002550572156906128,
        "z": -0.000101510901004076
    },
    "host": "hal9000",
    "humidity": 12.657461166381836,
    "id": "ea6d9dd2-85ad-4c18-9d74-468d6212343f",
    "mn": 0,
    "pressure": 841.728759765625,
    "temperature": 33.6828727722168,
    "tiltHeading": -1.8260560035705566,
    "timestamp": "2018-12-14T16:07:57.749Z"
}
```

## Command Line Execution:
```aidl
$ npm start -- [--host=<host>] [--period=<period>] [--queue=<queue>] [--sessionid=<sessionid>] [--hostame=<hostname>] [--userpass=<userpass-file>] [--tls_client_cert=<client-cert-file>] [--tls_client_key=<client-key-file>] [--tls_ca_certs=<ca_cert_file>[,<ca_cert_file>[...]]]
```

## .env Configuration File

```
HOST=localhost
QUEUE=sensehat/imu

PERIOD=100

USERPASS=tls/userpass
TLS_CLIENT_CERT=tls/client_certificate.pem
TLS_CLIENT_KEY=tls/client_key.pem
TLS_CA_CERTS=tls/ca_certificate.pem

# Display published messages
# 'true' .or. 'false'
DEBUG_AMQP_JSON=false
``` 

## SSL/TLS Configuration

This project is hardwired to use the _amqps://_ secure TLS connection scheme when connecting, and expects four files to be present to 
Follow the [RabbitMQ TLS Support](https://www.rabbitmq.com/ssl.html) page setting up the RabbitMQ server to execute:

* TLS_CLIENT_CERT - _The client certificate file._
* TLS_CLIENT_KEY - _The client key file._
* TLS_CA_CERTS - _The Certificate Authority (CA) file._
* USERPASS - The RabbitMQ _username_ and _password_ which has permissions to write to the QUEUE. Formatted as ```username:password```

_Using .pem formatted files recommended!_

* See [tls-gen](https://github.com/michaelklishin/tls-gen) to create test certificates

## Links:
* [node-sense-hat](https://github.com/balena-io-playground/node-sense-hat): Node.js Sense Hat Package
* [RTIMULib2](https://github.com/richardstechnotes/RTIMULib2): IMU Library
* [LSM9DS1 Inertal Module Datasheet](https://www.st.com/content/ccc/resource/technical/document/datasheet/1e/3f/2a/d6/25/eb/48/46/DM00103319.pdf/files/DM00103319.pdf/jcr:content/translations/en.DM00103319.pdf)
* [Sense Hat Docs](https://www.raspberrypi.org/documentation/hardware/sense-hat/): Basic Sense Hat Docs
* [yargs](https://github.com/yargs/yargs)
