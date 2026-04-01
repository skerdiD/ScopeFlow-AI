import { useEffect, useState } from "react";
import { supabase } from "./utils/supabase";

type Todo = {
  id: string | number;
  name: string;
};

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsTableSetup, setNeedsTableSetup] = useState(false);

  useEffect(() => {
    async function getTodos() {
      const { data, error: queryError } = await supabase
        .from("todos")
        .select("id,name");

      if (queryError) {
        setError(queryError.message);
        if (queryError.message.includes("Could not find the table")) {
          setNeedsTableSetup(true);
        }
      } else if (data) {
        setTodos(data as Todo[]);
      }

      setLoading(false);
    }

    getTodos();
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">ScopeFlow Setup Check</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Small text check: frontend is running and Supabase query is wired.
      </p>

      {loading && <p className="mt-4 text-sm">Loading todos...</p>}
      {error && <p className="mt-4 text-sm text-red-600">Error: {error}</p>}
      {needsTableSetup && (
        <p className="mt-2 text-sm">
          Action: run{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            client/supabase/setup_todos.sql
          </code>{" "}
          in Supabase SQL editor, then refresh.
        </p>
      )}

      {!loading && !error && (
        <ul className="mt-4 list-disc space-y-1 pl-5">
          {todos.map((todo) => (
            <li key={todo.id}>{todo.name}</li>
          ))}
          {todos.length === 0 && <li>No todos found yet.</li>}
        </ul>
      )}
    </main>
  );
}
