import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sentry-test")({
  component: SentryTestPage,
});

function SentryTestPage() {
  const triggerError = () => {
    throw new Error("Sentry Test Error - Manual Verification");
  };

  const triggerUncaughtError = () => {
    setTimeout(() => {
      throw new Error("Sentry Test Async Error - Manual Verification");
    }, 100);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Sentry Test Page</h1>

      <div className="space-y-4">
        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Test 1: Synchronous Error</h2>
          <p className="text-sm text-gray-600 mb-4">
            This will trigger an error immediately and should be caught by error boundary
          </p>
          <button
            onClick={triggerError}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Trigger Sync Error
          </button>
        </div>

        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Test 2: Asynchronous Error</h2>
          <p className="text-sm text-gray-600 mb-4">
            This will trigger an async error that should be caught by global error handler
          </p>
          <button
            onClick={triggerUncaughtError}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Trigger Async Error
          </button>
        </div>

        <div className="p-4 border rounded bg-blue-50">
          <h2 className="text-xl font-semibold mb-2">Expected Results</h2>
          <ul className="list-disc list-inside text-sm space-y-2">
            <li>Both errors should appear in Sentry dashboard</li>
            <li>Session replay should be attached to error events</li>
            <li>User ID should be visible if authenticated</li>
            <li>Error stack traces should show this file path</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
