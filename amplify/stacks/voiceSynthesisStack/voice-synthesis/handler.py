import json
import os
import io
import wave
from typing import Iterator
import logging
import onnxruntime as ort

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ort.set_default_logger_severity(4)

from piper.voice import PiperVoice

MODEL_PATH = os.environ.get('MODEL_PATH', '/var/task/models/es_ES-davefx-medium.onnx')

voice = None

def get_voice():
    global voice
    if voice is None:
        logger.info(f"Loading Piper voice model from {MODEL_PATH}")
        try:
            sess_options = ort.SessionOptions()
            sess_options.log_severity_level = 4
            
            voice = PiperVoice.load(MODEL_PATH, use_cuda=False)
            logger.info("Voice model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load voice model: {e}")
            import traceback
            traceback.print_exc()
            raise
    return voice

def create_wav_header(sample_rate: int, bits_per_sample: int, channels: int) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(bits_per_sample // 8)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b'')
    
    buffer.seek(0)
    return buffer.read()

def generate_audio_chunks(text: str, speed: float = 1.0) -> Iterator[bytes]:
    piper_voice = get_voice()
    
    sample_rate = piper_voice.config.sample_rate
    
    wav_header = create_wav_header(sample_rate, 16, 1)
    yield wav_header
    
    length_scale = 1.0 / speed
    
    audio_stream = piper_voice.synthesize_stream_raw(
        text,
        length_scale=length_scale
    )
    
    chunk_size = 4096
    buffer = bytearray()
    
    for audio_bytes in audio_stream:
        buffer.extend(audio_bytes)
        
        while len(buffer) >= chunk_size:
            yield bytes(buffer[:chunk_size])
            buffer = buffer[chunk_size:]
    
    if buffer:
        yield bytes(buffer)

def lambda_handler(event, context):
    try:
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event
        
        text = body.get('text', '')
        speed = float(body.get('speed', 1.0))
        
        if not text:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing text parameter'})
            }
        
        print(f"Generating audio for text: {text[:50]}... (speed: {speed})")
        
        response_stream = context.response_stream if hasattr(context, 'response_stream') else None
        
        if response_stream:
            response_stream.set_content_type('audio/wav')
            
            for chunk in generate_audio_chunks(text, speed):
                response_stream.write(chunk)
            
            response_stream.end()
        else:
            audio_chunks = list(generate_audio_chunks(text, speed))
            audio_data = b''.join(audio_chunks)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'audio/wav',
                    'Content-Length': str(len(audio_data))
                },
                'body': audio_data.hex(),
                'isBase64Encoded': False
            }
    
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
