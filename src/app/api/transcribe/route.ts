import { execSync } from 'child_process'
import { writeFileSync, unlinkSync, existsSync, createReadStream } from 'fs'
import path from 'path'
import os from 'os'
import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'
import ffmpegStatic from 'ffmpeg-static'

export async function POST(request: Request) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const anthropic = new Anthropic({ apiKey: process.env.VIDEO_ANTHROPIC_KEY })

  const formData = await request.formData()
  const file = formData.get('video') as File | null

  if (!file) {
    return Response.json({ error: 'Nessun file ricevuto' }, { status: 400 })
  }

  const ext = path.extname(file.name).toLowerCase() || '.mp4'
  const videoPath = path.join(os.tmpdir(), `video_${Date.now()}${ext}`)
  const audioPath = path.join(os.tmpdir(), `audio_${Date.now()}.mp3`)

  try {
    // Salva il file video in una cartella temporanea
    const buffer = Buffer.from(await file.arrayBuffer())
    writeFileSync(videoPath, buffer)

    // Estrai audio con ffmpeg (mono, 64kbps)
    const ffmpegBin = ffmpegStatic ?? 'ffmpeg'
    execSync(
      `"${ffmpegBin}" -i "${videoPath}" -vn -ac 1 -ar 16000 -b:a 64k "${audioPath}" -y`,
      { stdio: 'pipe' }
    )

    // Trascrizione con Groq Whisper
    const transcription = await groq.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: 'whisper-large-v3',
      language: 'it',
      response_format: 'text',
    })

    const transcript = transcription as unknown as string

    // Riassunto con Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Analizza questa trascrizione e fornisci:
1. Un riassunto conciso (3-5 frasi)
2. I punti chiave principali (lista puntata)
3. L'argomento principale trattato

Trascrizione:
${transcript}`,
        },
      ],
    })

    const summary = message.content[0].type === 'text' ? message.content[0].text : ''

    return Response.json({ transcript, summary })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore interno'
    return Response.json({ error: message }, { status: 500 })
  } finally {
    if (existsSync(videoPath)) unlinkSync(videoPath)
    if (existsSync(audioPath)) unlinkSync(audioPath)
  }
}
