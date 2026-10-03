import { NextResponse } from "next/server";

export async function readJsonBody(request: Request, maxBytes: number) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxBytes) {
    return {
      response: NextResponse.json(
        { error: "request_too_large", message: "The request is too large." },
        { status: 413 },
      ),
    } as const;
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return {
      response: NextResponse.json(
        { error: "invalid_request", message: "The request body could not be read." },
        { status: 400 },
      ),
    } as const;
  }

  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    return {
      response: NextResponse.json(
        { error: "request_too_large", message: "The request is too large." },
        { status: 413 },
      ),
    } as const;
  }

  try {
    return { value: JSON.parse(rawBody) as unknown } as const;
  } catch {
    return {
      response: NextResponse.json(
        { error: "invalid_request", message: "The request body was not valid JSON." },
        { status: 400 },
      ),
    } as const;
  }
}
