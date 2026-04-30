export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()}, This Week I&apos;m Sharper. All rights reserved.
      </p>
      </div>
    </footer>
  );
}
