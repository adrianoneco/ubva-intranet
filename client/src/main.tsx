import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from './contexts/AuthContext';
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

createRoot(document.getElementById("root")!).render(
	<QueryClientProvider client={queryClient}>
		<AuthProvider>
			<App />
		</AuthProvider>
	</QueryClientProvider>
);
