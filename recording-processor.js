// Based on sample from 
// https://github.com/GoogleChromeLabs/web-audio-samples/blob/main/src/audio-worklet/migration/worklet-recorder/recording-processor.js

class RecordingProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.sampleRate = 0;
    this.maxRecordingFrames = 0;
    this.numberOfChannels = 0;

    if (options && options.processorOptions) {
      const {
        numberOfChannels,
        sampleRate,
        maxFrameCount,
      } = options.processorOptions;
      this.sampleRate = sampleRate;
      this.maxRecordingFrames = maxFrameCount;
      this.numberOfChannels = numberOfChannels;
    }

    this._recordingBuffer = new Array(this.numberOfChannels).fill(new Float32Array(this.maxRecordingFrames));

    this.recordedFrames = 0;  
    this.framesSinceLastPublish = 0;
    this.publishInterval = this.sampleRate * 5;

    this.isRecording = true;
   
    this.port.postMessage({
      message: 'RECORDING_STARTED'  
    });        
  }

  process(inputs, outputs, parameters) {    
    for (let input = 0; input < 1; input++) {
      for (let channel = 0; channel < this.numberOfChannels; channel++) {
        for (let sample = 0; sample < inputs[input][channel].length; sample++) {
          const currentSample = inputs[input][channel][sample];
          // Copy data to recording buffer.
          if (this.isRecording) {
            this._recordingBuffer[channel][sample+this.recordedFrames] = currentSample;
          }
          // Pass data directly to output, unchanged.
          outputs[input][channel][sample] = currentSample;          
        }
      }
    }

    const shouldPublish = this.framesSinceLastPublish >= this.publishInterval;
    // Validate that recording hasn't reached its limit.
    if (this.isRecording) {
      if (this.recordedFrames + 128 < this.maxRecordingFrames) {
        this.recordedFrames += 128;
        // Post a recording recording length update on the clock's schedule
        if (shouldPublish) {
          this.port.postMessage({
            message: 'SHARE_RECORDING_BUFFER',
            buffer: this._recordingBuffer,
            recordingLength: this.recordedFrames
          });
          this.framesSinceLastPublish = 0;
          this.recordedFrames = 0
        } else {
          this.framesSinceLastPublish += 128;
        }
      } else {
        this.recordedFrames += 128;
        this.port.postMessage({
          message: 'SHARE_RECORDING_BUFFER',
          buffer: this._recordingBuffer,
          recordingLength: this.recordedFrames
        });
        this.recordedFrames = 0;
        this.framesSinceLastPublish = 0;
      } 
    } else {
      // console.log('stopping worklet processor node')
      this.recordedFrames = 0;
      this.framesSinceLastPublish = 0;
      return false;
    }

    return true;
  }
}

registerProcessor('recording-processor', RecordingProcessor);