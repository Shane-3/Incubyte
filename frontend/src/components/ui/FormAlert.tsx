/** Form-level error that does not belong to a single field. Announced immediately. */
export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-control border border-out/40 bg-out/5 px-3 py-2 text-sm text-text">
      {message}
    </p>
  );
}
