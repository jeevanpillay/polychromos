export function LoadingComponent() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center">
      <div className="flex space-x-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-primary h-3 w-3 rounded-full"
            style={{
              animation: "pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <p className="text-muted-foreground mt-4 text-sm">Loading...</p>
      <style>{`
        @keyframes pulse {
          0%, 60%, 100% {
            transform: scale(0.8);
            opacity: 0.3;
          }
          30% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
