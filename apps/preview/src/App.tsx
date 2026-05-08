export function App() {
  return (
    <div className="grid h-screen grid-cols-2 divide-x">
      <section className="overflow-auto p-6">
        <h2 className="mb-4 text-lg font-semibold">TSX (live React)</h2>
        <p className="text-sm text-muted-foreground">
          The fixture from <code>@tsxtoflutter/tsx-fixtures</code> renders here.
        </p>
        {/* TODO: dynamically render the fixture under inspection. */}
      </section>
      <section className="overflow-auto p-6">
        <h2 className="mb-4 text-lg font-semibold">Flutter Web</h2>
        <iframe
          title="flutter-preview"
          className="h-full w-full"
          src="http://localhost:8080/"
        />
      </section>
    </div>
  );
}
