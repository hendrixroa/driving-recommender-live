import json
import os
import io
import wave
import base64
from typing import Iterator
import logging
import sys

logging.basicConfig(level=logging.INFO, stream=sys.stdout, force=True)
logger = logging.getLogger(__name__)

os.environ['ORT_LOGGING_LEVEL'] = '4'
os.environ['ONNXRUNTIME_LOG_SEVERITY_LEVEL'] = '4'

try:
    from piper import PiperVoice
    logger.info("Piper module imported successfully")
except Exception as e:
    logger.error(f"Error importing piper: {e}")
    raise

MODEL_PATH = os.environ.get('MODEL_PATH', '/var/task/models/es_MX-claude-high.onnx')

voice = None

def get_voice():
    global voice
    if voice is None:
        logger.info(f"Loading Piper voice model from {MODEL_PATH}")
        try:
            voice = PiperVoice.load(MODEL_PATH)
            logger.info(f"Voice model loaded successfully. Sample rate: {voice.config.sample_rate}")
        except Exception as e:
            logger.error(f"Failed to load voice model: {e}")
            import traceback
            traceback.print_exc()
            raise
    return voice

def generate_complete_wav(text: str, speed: float = 1.0) -> bytes:
    piper_voice = get_voice()
    
    audio_chunks = []
    sample_rate = None
    sample_width = None
    channels = None
    
    logger.info(f"Starting synthesis for text: {text[:50]}...")
    
    for chunk in piper_voice.synthesize(text):
        if sample_rate is None:
            sample_rate = chunk.sample_rate
            sample_width = chunk.sample_width
            channels = chunk.sample_channels
            logger.info(f"Audio format: {sample_rate}Hz, {sample_width} bytes, {channels} channels")
        
        audio_chunks.append(chunk.audio_int16_bytes)
    
    audio_data = b''.join(audio_chunks)
    logger.info(f"Total audio data: {len(audio_data)} bytes")
    
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data)
    
    buffer.seek(0)
    wav_bytes = buffer.read()
    logger.info(f"Complete WAV file: {len(wav_bytes)} bytes")
    
    # Verify WAV header
    if wav_bytes[:4] == b'RIFF' and wav_bytes[8:12] == b'WAVE':
        logger.info("WAV header verified successfully")
    else:
        logger.error(f"Invalid WAV header! First 12 bytes: {wav_bytes[:12]}")
    
    return wav_bytes

def lambda_handler(event, context):
    try:
        logger.info(f"Lambda handler invoked with event keys: {event.keys()}")
        logger.info(f"Request context: {event.get('requestContext', {})}")
        
        # Parse request body
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event
        
        text = body.get('text', '')
        speed = float(body.get('speed', 1.0))
        
        if not text:
            logger.error("Missing text parameter")
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Missing text parameter'})
            }
        
        logger.info(f"Generating audio for text: {text[:50]}... (speed: {speed})")
        
        # Generate complete WAV file
        wav_data = generate_complete_wav(text, speed)
        
        # Return as base64-encoded binary response
        logger.info(f"Returning {len(wav_data)} bytes as base64-encoded response")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'audioData': base64.b64encode(wav_data).decode('utf-8'),
                'contentType': 'audio/wav',
                'size': len(wav_data)
            })
        }
    
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': str(e)})
        }
