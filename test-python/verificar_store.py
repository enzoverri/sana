import os, wave
from google import genai

api_key = os.environ["GEMINI_API_KEY"]
store_name = "fileSearchStores/baseconocimientoproyecto-scc5nr7admqz"
client = genai.Client(api_key=api_key)

docs = list(client.file_search_stores.documents.list(parent=store_name))
print(f"Documentos en el Store: {len(docs)}", [d.display_name for d in docs])

print("Consultando a Gemini con File Search...")
res = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="¿Cuáles son los horarios y servicios disponibles según el documento?",
    config={"tools": [{"file_search": {"file_search_store_names": [store_name]}}]},
)
print("Respuesta Gemini:", res.text)

print("Generando audio TTS...")
tts_res = client.models.generate_content(
    model="gemini-2.5-flash-preview-tts",
    contents=res.text,
    config={
        "response_modalities": ["AUDIO"],
        "speech_config": {"voice_config": {"prebuilt_voice_config": {"voice_name": "Aoede"}}},
    },
)

pcm_data = tts_res.candidates[0].content.parts[0].inline_data.data
with wave.open("salida.wav", "wb") as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(24000)
    wf.writeframes(pcm_data)

print("¡Listo! Audio guardado en test-python/salida.wav")
