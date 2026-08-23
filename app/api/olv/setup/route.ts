export async function POST() {
  return Response.json(
    { error: "New account creation is disabled for this private MVP." },
    { status: 403 },
  );
}
