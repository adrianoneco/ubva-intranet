import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Code2, 
  Zap, 
  Database, 
  Server, 
  Layers, 
  Shield,
  Palette,
  Box,
  Cloud,
  Gauge,
  GitBranch
} from "lucide-react";
import { Link } from "wouter";

const technologies = [
  {
    name: "React 18",
    category: "Frontend",
    icon: Code2,
    color: "#61DAFB",
    description: "Biblioteca JavaScript para construção de interfaces de usuário reativas e componentizadas.",
    features: ["Hooks modernos", "Componentes funcionais", "Virtual DOM", "JSX"]
  },
  {
    name: "Vite",
    category: "Build Tool",
    icon: Zap,
    color: "#646CFF",
    description: "Build tool ultrarrápido com HMR instantâneo e otimização nativa para produção.",
    features: ["HMR instantâneo", "Build otimizado", "ESM nativo", "TypeScript integrado"]
  },
  {
    name: "TypeScript",
    category: "Linguagem",
    icon: Shield,
    color: "#3178C6",
    description: "Superset tipado do JavaScript que adiciona type safety em todo o codebase.",
    features: ["Type safety", "IntelliSense", "Refactoring seguro", "Autocomplete"]
  },
  {
    name: "Tailwind CSS",
    category: "Estilização",
    icon: Palette,
    color: "#06B6D4",
    description: "Framework CSS utilitário para criação rápida de interfaces responsivas e customizáveis.",
    features: ["Utility-first", "Responsivo", "Dark mode", "Componentes Shadcn"]
  },
  {
    name: "Express",
    category: "Backend",
    icon: Server,
    color: "#000000",
    description: "Framework web minimalista e flexível para Node.js, perfeito para APIs RESTful.",
    features: ["Middleware", "Roteamento", "API REST", "TypeScript"]
  },
  {
    name: "Drizzle ORM",
    category: "ORM",
    icon: Database,
    color: "#C5F74F",
    description: "ORM TypeScript-first com queries type-safe e performance excepcional.",
    features: ["Type-safe", "Zero overhead", "Migrations", "Relations"]
  },
  {
    name: "PostgreSQL",
    category: "Database",
    icon: Database,
    color: "#336791",
    description: "Banco de dados relacional robusto, ACID-compliant e altamente extensível.",
    features: ["ACID", "JSON support", "Full-text search", "Escalável"]
  },
  {
    name: "Redis",
    category: "Cache",
    icon: Gauge,
    color: "#DC382D",
    description: "Armazenamento em memória ultra-rápido para cache, sessões e filas de mensagens.",
    features: ["In-memory", "Pub/Sub", "Cache inteligente", "Sub-milissegundos"]
  },
  {
    name: "MinIO",
    category: "Storage",
    icon: Cloud,
    color: "#C72C48",
    description: "Object storage S3-compatible para armazenamento escalável de arquivos e mídia.",
    features: ["S3 API", "Alta performance", "Multi-tenant", "Encryption"]
  },
];

const architectureFeatures = [
  {
    title: "Monorepo",
    icon: GitBranch,
    description: "Estrutura unificada com frontend, backend e tipos compartilhados"
  },
  {
    title: "Type Safety",
    icon: Shield,
    description: "TypeScript end-to-end com validação em todas as camadas"
  },
  {
    title: "Componentização",
    icon: Box,
    description: "Componentes React reutilizáveis com Shadcn UI"
  },
  {
    title: "Camadas",
    icon: Layers,
    description: "Separação clara entre apresentação, lógica e dados"
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-6" variant="secondary">
              Arquitetura Monorepo Full-Stack
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              TaskFlow
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground mb-4 max-w-3xl mx-auto">
              Demonstração completa de uma aplicação moderna com{" "}
              <span className="text-primary font-semibold">9 tecnologias</span> integradas
            </p>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              React + Vite + TypeScript + Tailwind + Express + Drizzle + PostgreSQL + Redis + MinIO
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/app">
                <Button size="lg" data-testid="button-try-demo">
                  Experimentar Demo
                </Button>
              </Link>
              <Button variant="outline" size="lg" asChild data-testid="button-github">
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Ver no GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Features */}
      <section className="py-16 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Arquitetura Profissional</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Estrutura organizada, type-safe e escalável seguindo as melhores práticas modernas
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {architectureFeatures.map((feature) => (
              <Card key={feature.title} className="hover-elevate">
                <CardContent className="p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mx-auto mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Technologies Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Stack Tecnológico</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Cada tecnologia foi cuidadosamente escolhida para demonstrar integração, 
              performance e melhores práticas de desenvolvimento
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {technologies.map((tech) => (
              <Card key={tech.name} className="hover-elevate" data-testid={`card-tech-${tech.name.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <tech.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">{tech.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {tech.category}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {tech.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tech.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Type Safety End-to-End</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Tipos compartilhados garantem consistência entre frontend e backend
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Shared Types (shared/schema.ts)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-card p-4 rounded-lg text-sm overflow-x-auto border">
                  <code className="text-foreground">{`// Drizzle schema
export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed"),
  categoryId: integer("category_id"),
});

// Zod validation
export const insertTaskSchema = 
  createInsertSchema(tasks);

// TypeScript types
export type Task = 
  typeof tasks.$inferSelect;`}</code>
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Backend + Frontend</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-card p-4 rounded-lg text-sm overflow-x-auto border">
                  <code className="text-foreground">{`// Backend (server/routes.ts)
app.post("/api/tasks", async (req, res) => {
  const result = insertTaskSchema
    .safeParse(req.body);
  const task = await storage
    .createTask(result.data);
  res.json(task);
});

// Frontend (client/src/pages/home.tsx)
const { data: tasks } = 
  useQuery<Task[]>({
    queryKey: ["/api/tasks"]
  });`}</code>
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Funcionalidades Implementadas</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Cache com Redis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Sistema de cache inteligente para reduzir latência e carga no banco de dados.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    Cache automático de queries
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    Invalidação ao criar/atualizar
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    TTL configurável
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Storage com MinIO</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Armazenamento de arquivos S3-compatible para uploads escaláveis.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    API compatível com S3
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    URLs assinadas (presigned)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    Gerenciamento de buckets
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>PostgreSQL + Drizzle</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Banco relacional com ORM type-safe e migrations automatizadas.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    Queries type-safe
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    Relações automáticas
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    Migrations declarativas
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para Experimentar?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Explore a aplicação completa e veja todas as tecnologias em ação
          </p>
          <Link href="/app">
            <Button size="lg" data-testid="button-cta-demo">
              Acessar Aplicação Demo
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
