require('dotenv').config();
const Kafka      = require('node-rdkafka');
const express    = require('express');
const app        = express();
const server     = require('http').createServer(app);
const socket     = require('socket.io')(server);
const URL        = require('url');

const PORT       = process.env.PORT || 5001;
const nodeEnv    = process.env.NODE_ENV || 'development';
const fs         = require('fs');

const currentPath  = process.cwd();

if (!process.env.KAFKA_PREFIX)          throw new Error('KAFKA_PREFIX is not set.')
if (!process.env.KAFKA_URL)             throw new Error('KAFKA_URL is not set.')
if (!process.env.KAFKA_CONSUMER_GROUP)  throw new Error('KAFKA_TOPIC is not set.')
if (!process.env.KAFKA_TRUSTED_CERT)    throw new Error('KAFKA_TRUSTED_CERT is not set.')
if (!process.env.KAFKA_CLIENT_CERT)     throw new Error('KAFKA_CLIENT_CERT is not set.')
if (!process.env.KAFKA_CLIENT_CERT_KEY) throw new Error('KAFKA_CLIENT_CERT_KEY is not set.')

// Kafka Config
const kafkaBrokerUrls = process.env.KAFKA_URL;
const kafkaTopicsString=process.env.KAFKA_TOPIC;

let kafkaTopics = kafkaTopicsString.split(",");
kafkaTopics = kafkaTopics.map((topic)=>{
  return `${process.env.KAFKA_PREFIX}${topic}`
});
let brokerHostnames = kafkaBrokerUrls.split(",").map((u)=>{
  return URL.parse(u).host;
});


//
// Kafka Consumer w/ socket.io
//

console.log('Initializing Kafka Consumer...')
// different consumer groupIDs for local dev & prod
var consumer = new Kafka.KafkaConsumer({
  // 'debug': 'all',
  //'enable.auto.commit':       false,
  'client.id':                `edm/${process.env.DYNO || 'localhost'}`,
  'group.id': `${process.env.KAFKA_PREFIX}${process.env.KAFKA_CONSUMER_GROUP}`,
  'metadata.broker.list': brokerHostnames.toString(),
  'security.protocol': 'SSL',
  'ssl.ca.location':          "tmp/env/KAFKA_TRUSTED_CERT",
  'ssl.certificate.location': "tmp/env/KAFKA_CLIENT_CERT",
  'ssl.key.location':         "tmp/env/KAFKA_CLIENT_CERT_KEY",
  'enable.auto.commit': true
}, {});


consumer.connect({}, (err, data) => {
  if(err) {
    console.error(`consumer connection callback err: ${err}`);
  }else {
    console.log(`Connection to kafka broker successful: ${JSON.stringify(data)}`)
  }
});


consumer
  .on('ready', (id, metadata) => {
    console.log(kafkaTopics);
    //['milk-3411.edm-ui-click','milk-3411.edm-ui-pageload']
    consumer.subscribe(kafkaTopics); 
    consumer.consume();
    consumer.on('error', err => {
      console.log(`!      Error in Kafka consumer: ${err.stack}`);
    });
    console.log('Kafka consumer ready.' + JSON.stringify(metadata));
    console.log(consumer.assignments());
  })
  .on('data', function(data) {
    console.log("data!");
    const message = data.value.toString()
    console.log(message, `Offset: ${data.offset}`, `partition: ${data.partition}`);
    console.log(consumer.assignments());
    // writeMessageToPostgres(message,consumer,data);
    socket.sockets.emit('event', message);
  })
  .on('event.log', function(log) {
    console.log(log);
  })
  .on('event.error', function(err) {
    console.error('Error from consumer');
    console.error(err);
  });


//
// Server
//

server.listen(PORT, function () {
  console.log(`Listening on port ${PORT}`);
});


