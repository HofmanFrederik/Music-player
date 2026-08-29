import { NextRequest, NextResponse } from "next/server";
import { AcrCloudRequestError, NoMatchError, identifyAudio } from "@/lib/acrcloud";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Geen audiofragment ontvangen." }, { status: 400 });
  }

  try {
    const result = await identifyAudio(audio);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NoMatchError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AcrCloudRequestError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("Onverwachte fout bij /api/recognise", error);
    return NextResponse.json({ error: "Onverwachte fout bij herkenning." }, { status: 500 });
  }
}
