import os
from google import genai
from google.cloud import texttospeech

api_key = os.environ["GEMINI_API_KEY"]
store_name = "fileSearchStores/baseconocimientoproyecto-ru73hla28za8"

print("1. Consultando documento con gemini-3.8-flash...", flush=True)
ai_client = genai.Client(api_key=api_key)
res = ai_client.models.generate_content(
    model="gemini-3.8-flash",
    contents="¿Cuáles son los horarios y servicios disponibles según el documento?",
    config={"tools": [{"file_search": {"file_search_store_names": [store_name]}}]},
)
print("Respuesta:", res.text, flush=True)

print("2. Generando audio con Google Cloud Text-to-Speech...", flush=True)
tts_client = texttospeech.TextToSpeechClient()
synthesis_input = texttospeech.SynthesisInput(text=res.text.replace("*", ""))
voice = texttospeech.VoiceSelectionParams(
    language_code="es-US",
    name="es-US-Neural2-A",
)
audio_config = texttospeech.AudioConfig(
    audio_encoding=texttospeech.AudioEncoding.MP3
)

tts_response = tts_client.synthesize_speech(
    input=synthesis_input, voice=voice, audio_config=audio_config
)

with open("salida.mp3", "wb") as out:
    out.write(tts_response.audio_content)

os.makedirs("../backend/src", exist_ok=True)
with open("../backend/.env", "w", encoding="utf-8") as env_file:
    env_file.write(
        f"PORT=3000\n"
        f"GEMINI_API_KEY={api_key}\n"
        f"FILE_SEARCH_STORE_NAME={store_name}\n"
        f"GEMINI_MODEL=gemini-3.8-flash\n"
    )

print("¡Listo! Audio guardado en test-python/salida.mp3 y backend/.env configurado.", flush=True)
