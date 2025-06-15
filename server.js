const WebSocket = require('ws');
const Speech = require('@google-cloud/speech');
const fs = require('fs');
const streams = require('memory-streams');
const util = require('util');
const tempfile = 'temp/stream.wav';

let wsInstance = null;

const request = {
  config: {
    encoding: 'LINEAR16',
    // sampleRateHertz: 16000,
    sampleRateHertz: 44100,
    languageCode: 'en-US',
    // enableWordTimeOffsets: true,
    enableAutomaticPunctuation: true,
    model: 'default',
  },
  interimResults: true, // If you want interim results, set this to true
  verbose: true,
};

const client = new Speech.SpeechClient({
  apiKey: '*******************************'
});

const recognizeStream = client
  .streamingRecognize(request)
  .on('error', console.error)
  .on('data', data => {
    if (data.results && data.results[0]) {
      wsInstance &&
        wsInstance.send(
          JSON.stringify({
            isFinal: data.results[0].isFinal,
            text: data.results[0].alternatives[0].transcript,
          })
        );
    }
  });

console.log('Connected to google cloud speech api and ready to accept stream');

// var reader = fs.createReadStream('./test.wav');
// reader.pipe(recognizeStream);

var reader = new streams.ReadableStream('');
// var writer = fs.createWriteStream('./test2.wav');
// reader.pipe(writer);

// --- socket ---
const wss = new WebSocket.Server({ host: '0.0.0.0', port: 12345 });
wss.on('connection', (ws) => {
  console.log('connected');
  ws.on('message', (message) => {
    if (Buffer.from(message).toString() === 'start') {
      console.log('received start: streaming into google');
      reader.pipe(recognizeStream);
      // reader.pipe(process.stdout);      
    } else if (Buffer.from(message).toString() === 'end') {
      console.log('\n\n\n======================\nstop');
    } else {
      // const buf = Buffer.from(message);
      // console.log(util.inspect(message));
      reader.append(message);
    }
  });

  ws.on('error', (error) => {
    console.error(err);
  });

  wsInstance = ws; // ws.send('something');
});
console.log('WebSocket is ready to accept audio streaming');
