let audioContext;
let mediaRecorder;
let socket;
const contextOptions = { latencyHint: "interactive" };

if (window.webkitAudioContext) {
  // AudioContext is undefined in Safari and old versions of Chrome
  audioContext = new (window.webkitAudioContext)(contextOptions)
} else {
  audioContext = new AudioContext(contextOptions)
}

var constraints = window.constraints = {
  audio: true,
  video: false
};

$(document).ready(() => {
  console.log('document.ready');

  const button = $("button#control");

  button.click(async () => {
    if (button.text() === 'Start') {
      console.log('Start Recording, API calls');

      await audioContext.resume();
      const audioWorkletIsSupported = audioContext.audioWorklet !== undefined;
      if (!audioWorkletIsSupported) {
        console.error('worklet not supported!');
        await this.alertService.createAlert(
          'Audio Worklet Not Supported',
          'error'
        );
      }
      
      try {
        await audioContext.audioWorklet.addModule('recording-processor.js');
        // await audioContext.audioWorklet.addModule('demo-processor.js');
      } catch (ae) {
        console.error(ae);
        await this.alertService.createAlert(
          'Could not add the audio module',
          'error'
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
          
      const source1 = audioContext.createMediaStreamSource(stream);
      
      socket = new WebSocket("ws://localhost:12345/");

      socket.binaryType = "arraybuffer";
      socket.onopen = () => {
        // socket.send(JSON.stringify({
        //   format: "LINEAR16",
        //   language: 'en-US',
        //   punctuation: true,
        //   rate: 44100
        // }));
        console.log('socket:opened:sending start');
        socket.send('start');
      }
      socket.onmessage = (b) => {
        const data = JSON.parse(b.data);
        console.log('received:', data);

        if (data.isFinal) {
          $(".output-final").append(
            "<p>" + data.text + "</p>"
          );
        } else {
          $(".output").text(data.text);
        }
      };

      mediaRecorder = new AudioWorkletNode(
          audioContext,
          'recording-processor',
          {
            processorOptions: {
              numberOfChannels: 1,
              sampleRate: audioContext.sampleRate,
              maxFrameCount: audioContext.sampleRate * 1 / 10
            },
          },
        );
        
      mediaRecorder.port.onmessageerror = async (ev) => {
        console.error('Error receiving message from worklet', ev);
        await this.alertService.createAlert(
          'Error from worklet',
          'error'
        )
      };    
      
      const destination = audioContext.createMediaStreamDestination();    
      mediaRecorder.connect(destination);
      source1.connect(mediaRecorder)      
    
      mediaRecorder.port.onmessage = (event) => {
        // console.log('audio:event');
        if (event.data.message === 'SHARE_RECORDING_BUFFER') {
          let input = event.data.buffer[0] || new Float32Array(4096);

          for (var idx = input.length, newData = new Int16Array(idx); idx--;)
            newData[idx] = 32767 * Math.min(1, input[idx]);

          if (socket.readyState === 1) {
            // console.log(newData.length);
            // socket.send(newData.buffer);
            socket.send(newData);
          }        
        }
      }          
      
      button.text('Stop').addClass('stop').removeClass('start');
    } else {
      mediaRecorder.port.postMessage({
        message: 'UPDATE_RECORDING_STATE',
        setRecording: false,
      });
      mediaRecorder.port.close();
      mediaRecorder.disconnect();
      if (socket) {
        socket.readyState && socket.send('end');
        socket.readyState && socket.close();
      }

      button.text('Start').removeClass('stop').addClass('start');
    }
  })
});
