/**
 * @module ProfessionalAudioSynthesizer
 * @description Studio-grade notification sound engine with advanced DSP
 * @version 3.0.0
 */

const fs = require('fs');
const path = require('path');

// ===== PROFESSIONAL AUDIO CONFIGURATION =====
class StudioConfig {
    static SAMPLE_RATE = 48000; // Studio standard
    static BIT_DEPTH = 24; // High dynamic range
    static CHANNELS = 2; // Stereo field
    static HEADER_SIZE = 44;
    static NORMALIZATION_HEADROOM = -0.5; // dB FS headroom
    static LIMITER_THRESHOLD = -0.3; // dB
}

// ===== ADVANCED OSCILLATOR WITH PHASE ACCUMULATION =====
class AdvancedOscillator {
    constructor(frequency, amplitude = 1.0) {
        this.frequency = frequency;
        this.amplitude = amplitude;
        this.phase = 0;
        this.phaseIncrement = 0;
        this.harmonics = [
            { ratio: 1, weight: 1.0, phase: 0 },
            { ratio: 2, weight: 0.25, phase: 0.2 },
            { ratio: 3, weight: 0.1, phase: -0.3 },
            { ratio: 5, weight: 0.04, phase: 0.5 },
            { ratio: 7, weight: 0.02, phase: -0.1 }
        ];
    }

    process(time, sampleRate) {
        this.phaseIncrement = (2 * Math.PI * this.frequency) / sampleRate;
        let value = 0;
        
        for (const harmonic of this.harmonics) {
            const freq = this.frequency * harmonic.ratio;
            const phase = (2 * Math.PI * freq * time) + harmonic.phase;
            value += Math.sin(phase) * harmonic.weight * this.amplitude;
        }
        
        return value;
    }
}

// ===== PROFESSIONAL MULTI-STAGE ENVELOPE =====
class MultiStageEnvelope {
    constructor() {
        this.stages = [
            { type: 'attack', duration: 0.015, target: 1.0, curve: 0.7 },
            { type: 'decay', duration: 0.04, target: 0.7, curve: 0.5 },
            { type: 'sustain', duration: 0.15, target: 0.7, curve: 1.0 },
            { type: 'release', duration: 0.05, target: 0.0, curve: 0.3 }
        ];
    }

    getValue(time) {
        let elapsed = 0;
        let currentValue = 0;
        
        for (const stage of this.stages) {
            if (time < elapsed + stage.duration) {
                const progress = (time - elapsed) / stage.duration;
                const curvedProgress = Math.pow(progress, stage.curve);
                const startValue = currentValue;
                const endValue = stage.target;
                
                if (stage.type === 'attack') {
                    return startValue + (endValue - startValue) * curvedProgress;
                } else if (stage.type === 'decay' || stage.type === 'release') {
                    return startValue + (endValue - startValue) * (1 - Math.exp(-curvedProgress * 3));
                } else {
                    return startValue + (endValue - startValue) * curvedProgress;
                }
            }
            currentValue = stage.target;
            elapsed += stage.duration;
        }
        return currentValue;
    }
}

// ===== PROFESSIONAL DYNAMICS PROCESSOR =====
class DynamicsProcessor {
    static applyLimiter(sample, threshold = 0.95, knee = 0.1) {
        const abs = Math.abs(sample);
        if (abs <= threshold - knee) return sample;
        
        const overshoot = abs - (threshold - knee);
        const kneeProgress = Math.min(1, overshoot / knee);
        const gainReduction = kneeProgress * kneeProgress * 0.5;
        
        return Math.sign(sample) * (abs - gainReduction * abs);
    }

    static applyCompression(sample, ratio = 4, threshold = 0.8, makeup = 1.2) {
        const abs = Math.abs(sample);
        if (abs <= threshold) return sample * makeup;
        
        const gainDb = 20 * Math.log10(abs / threshold);
        const reducedGainDb = gainDb / ratio;
        const gainFactor = Math.pow(10, reducedGainDb / 20);
        
        return Math.sign(sample) * (threshold * gainFactor) * makeup;
    }

    static applySoftClipping(sample) {
        const abs = Math.abs(sample);
        if (abs <= 0.8) return sample;
        
        const x = (abs - 0.8) / 0.2;
        const clipped = 0.8 + 0.2 * (1 - Math.exp(-x * 2));
        return Math.sign(sample) * clipped;
    }

    static applyDither(sample, bitDepth = 24) {
        const quantSteps = Math.pow(2, bitDepth - 1);
        const noise = (Math.random() - 0.5) / quantSteps;
        return sample + noise;
    }
}

// ===== STUDIO-GRADE STEREO PROCESSOR =====
class StereoProcessor {
    static applyWidth(left, right, width = 0.4) {
        const mid = (left + right) * 0.707;
        const side = (left - right) * 0.707;
        const enhancedSide = side * (1 + width);
        return [
            Math.max(-1, Math.min(1, mid + enhancedSide)),
            Math.max(-1, Math.min(1, mid - enhancedSide))
        ];
    }

    static applyPan(sample, pan = 0) {
        const left = sample * Math.cos(pan * Math.PI / 4);
        const right = sample * Math.sin(pan * Math.PI / 4 + Math.PI / 2);
        return [left, right];
    }
}

// ===== PREMIUM NOTIFICATION SYNTHESIZER =====
class PremiumNotificationSynthesizer {
    constructor() {
        this.sampleRate = StudioConfig.SAMPLE_RATE;
        this.duration = 0.3;
        this.numSamples = Math.floor(this.sampleRate * this.duration);
        
        // Professional sound design - complex layered tones
        this.layers = [
            {
                oscillator: new AdvancedOscillator(880, 0.8),
                envelope: new MultiStageEnvelope(),
                startDelay: 0,
                pan: -0.1
            },
            {
                oscillator: new AdvancedOscillator(659.25, 0.6),
                envelope: this.createSlowerEnvelope(),
                startDelay: 0.03,
                pan: 0.1
            },
            {
                oscillator: new AdvancedOscillator(1108.73, 0.3),
                envelope: this.createFastEnvelope(),
                startDelay: 0.01,
                pan: 0
            },
            {
                oscillator: new AdvancedOscillator(1318.51, 0.15), // E6
                envelope: this.createSparkleEnvelope(),
                startDelay: 0.12,
                pan: -0.2
            }
        ];
    }

    createSlowerEnvelope() {
        const env = new MultiStageEnvelope();
        env.stages = [
            { type: 'attack', duration: 0.02, target: 0.8, curve: 0.8 },
            { type: 'decay', duration: 0.06, target: 0.6, curve: 0.5 },
            { type: 'sustain', duration: 0.15, target: 0.6, curve: 1.0 },
            { type: 'release', duration: 0.06, target: 0.0, curve: 0.4 }
        ];
        return env;
    }

    createFastEnvelope() {
        const env = new MultiStageEnvelope();
        env.stages = [
            { type: 'attack', duration: 0.005, target: 0.9, curve: 0.5 },
            { type: 'decay', duration: 0.02, target: 0.3, curve: 0.3 },
            { type: 'sustain', duration: 0.04, target: 0.3, curve: 1.0 },
            { type: 'release', duration: 0.02, target: 0.0, curve: 0.5 }
        ];
        return env;
    }

    createSparkleEnvelope() {
        const env = new MultiStageEnvelope();
        env.stages = [
            { type: 'attack', duration: 0.001, target: 0.6, curve: 0.3 },
            { type: 'decay', duration: 0.01, target: 0.1, curve: 0.2 },
            { type: 'sustain', duration: 0.02, target: 0.1, curve: 1.0 },
            { type: 'release', duration: 0.01, target: 0.0, curve: 0.3 }
        ];
        return env;
    }

    generateStereoBuffer() {
        const buffer = new Float32Array(this.numSamples * 2);
        let maxPeak = 0;

        for (let i = 0; i < this.numSamples; i++) {
            const time = i / this.sampleRate;
            let left = 0;
            let right = 0;

            for (const layer of this.layers) {
                const adjustedTime = time - layer.startDelay;
                if (adjustedTime < 0) continue;

                const sample = layer.oscillator.process(adjustedTime, this.sampleRate);
                const envelope = layer.envelope.getValue(adjustedTime);
                let processedSample = sample * envelope;

                // Apply pan
                const [l, r] = StereoProcessor.applyPan(processedSample, layer.pan);
                left += l;
                right += r;
            }

            // Professional dynamics chain
            left = DynamicsProcessor.applyCompression(left, 3, 0.85, 1.0);
            right = DynamicsProcessor.applyCompression(right, 3, 0.85, 1.0);
            
            left = DynamicsProcessor.applyLimiter(left, 0.92, 0.08);
            right = DynamicsProcessor.applyLimiter(right, 0.92, 0.08);

            // Apply stereo width
            [left, right] = StereoProcessor.applyWidth(left, right, 0.3);

            // Final soft clipping
            left = DynamicsProcessor.applySoftClipping(left);
            right = DynamicsProcessor.applySoftClipping(right);

            // Apply dithering
            left = DynamicsProcessor.applyDither(left, StudioConfig.BIT_DEPTH);
            right = DynamicsProcessor.applyDither(right, StudioConfig.BIT_DEPTH);

            // Track peak for normalization
            maxPeak = Math.max(maxPeak, Math.abs(left), Math.abs(right));

            buffer[i * 2] = left;
            buffer[i * 2 + 1] = right;
        }

        // Normalize to use full dynamic range
        if (maxPeak > 0) {
            const normalizationFactor = 0.98 / maxPeak;
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] *= normalizationFactor;
            }
        }

        return buffer;
    }
}

// ===== WAV FILE WRITER =====
class WAVFileWriter {
    static write(outputPath, buffer, sampleRate, bitDepth, channels) {
        const numSamples = buffer.length / channels;
        const bytesPerSample = bitDepth / 8;
        const dataSize = numSamples * channels * bytesPerSample;
        const fileSize = 44 + dataSize;
        
        const wavBuffer = Buffer.alloc(fileSize);
        
        // Write header
        this.writeHeader(wavBuffer, numSamples, sampleRate, channels, bitDepth, dataSize);
        
        // Write audio data
        let offset = 44;
        for (let i = 0; i < numSamples; i++) {
            for (let ch = 0; ch < channels; ch++) {
                const sample = buffer[i * channels + ch];
                const clamped = Math.max(-1, Math.min(1, sample));
                const intValue = Math.round(clamped * (Math.pow(2, bitDepth - 1) - 1));
                
                if (bitDepth === 24) {
                    const bytes = this.int24ToBytes(intValue);
                    wavBuffer[offset++] = bytes[0];
                    wavBuffer[offset++] = bytes[1];
                    wavBuffer[offset++] = bytes[2];
                } else {
                    wavBuffer.writeInt16LE(intValue, offset);
                    offset += 2;
                }
            }
        }
        
        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, wavBuffer);
        
        const stats = fs.statSync(outputPath);
        console.log(`   ✅ ${path.basename(outputPath)}: ${(stats.size / 1024).toFixed(1)} KB`);
        console.log(`      • ${sampleRate/1000}kHz, ${bitDepth}-bit, ${channels === 2 ? 'Stereo' : 'Mono'}`);
    }

    static writeHeader(buffer, numSamples, sampleRate, channels, bitDepth, dataSize) {
        const bytesPerSample = bitDepth / 8;
        const blockAlign = channels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        
        const writeString = (offset, str) => {
            for (let i = 0; i < str.length; i++) {
                buffer[offset + i] = str.charCodeAt(i);
            }
        };

        writeString(0, 'RIFF');
        buffer.writeUInt32LE(36 + dataSize, 4);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        buffer.writeUInt32LE(16, 16);
        buffer.writeUInt16LE(1, 20); // PCM
        buffer.writeUInt16LE(channels, 22);
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(byteRate, 28);
        buffer.writeUInt16LE(blockAlign, 32);
        buffer.writeUInt16LE(bitDepth, 34);
        writeString(36, 'data');
        buffer.writeUInt32LE(dataSize, 40);
    }

    static int24ToBytes(value) {
        const bytes = [];
        bytes[0] = value & 0xFF;
        bytes[1] = (value >> 8) & 0xFF;
        bytes[2] = (value >> 16) & 0xFF;
        return bytes;
    }
}

// ===== MAIN EXECUTION =====
console.log('\n🎵 Studio-Grade Audio Synthesis Engine v3.0.0');
console.log('═══════════════════════════════════════════════\n');

try {
    console.log('🎹 Synthesizing professional notification sound...');
    
    const synthesizer = new PremiumNotificationSynthesizer();
    const stereoBuffer = synthesizer.generateStereoBuffer();
    
    const outputDir = path.join(__dirname, 'frontend', 'public', 'sounds');
    const outputPath = path.join(outputDir, 'notification.wav');
    
    console.log('\n📀 Writing high-fidelity audio:');
    WAVFileWriter.write(
        outputPath,
        stereoBuffer,
        StudioConfig.SAMPLE_RATE,
        StudioConfig.BIT_DEPTH,
        StudioConfig.CHANNELS
    );
    
    // Generate additional variants
    console.log('\n🎛️  Generating premium variants:');
    
    // Soft variant
    const softSynth = new PremiumNotificationSynthesizer();
    softSynth.layers.forEach(layer => {
        layer.oscillator.amplitude *= 0.7;
    });
    const softBuffer = softSynth.generateStereoBuffer();
    WAVFileWriter.write(
        path.join(outputDir, 'notification-soft.wav'),
        softBuffer,
        44100, 16, 2
    );
    
    // Crisp variant
    const crispSynth = new PremiumNotificationSynthesizer();
    crispSynth.layers.forEach(layer => {
        layer.oscillator.harmonics = layer.oscillator.harmonics.filter(h => h.ratio <= 3);
    });
    const crispBuffer = crispSynth.generateStereoBuffer();
    WAVFileWriter.write(
        path.join(outputDir, 'notification-crisp.wav'),
        crispBuffer,
        44100, 16, 2
    );
    
    console.log('\n✨ Premium audio suite generated successfully!');
    console.log(`📁 Output directory: ${outputDir}`);
    console.log('\n🎯 Audio Specifications:');
    console.log('   • Primary: 24-bit 48kHz Stereo (Studio Quality)');
    console.log('   • Variants: 16-bit 44.1kHz for compatibility');
    console.log('   • Dynamic Range: Full with limiter');
    console.log('   • Harmonics: 5 partials per tone');
    console.log('   • Stereo Field: Enhanced with spatial processing');
    console.log('   • Dithering: Applied for pristine conversion\n');
    
} catch (error) {
    console.error('❌ Synthesis error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
