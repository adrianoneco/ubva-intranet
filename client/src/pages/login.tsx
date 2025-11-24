import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export function LoginPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const auth = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await auth.login(username, password);
      if (user) setLocation('/');
    } catch (err: any) {
      setError(err?.message || 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Entrar no Intranet</CardTitle>
          <CardDescription>Faça login para gerenciar conteúdos e agendamentos.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seu usuário" />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="sua senha" />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex items-center justify-between">
              <Button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
              <Button variant="ghost" onClick={() => setLocation('/')}>Voltar</Button>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Dica: em desenvolvimento use <code>admin</code>/<code>admin</code> se você não configurou credenciais.
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await auth.login(username, password);
      if (user) {
        onClose();
        setLocation('/');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o:any)=> !o && onClose()}>
      <DialogContent className="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Autentique-se para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Usuário</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuário" />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="senha" />
              </div>
              {error && <div className="text-sm text-red-600">{error}</div>}
              <div className="flex items-center justify-between">
                <Button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
                <Button variant="ghost" onClick={() => { onClose(); setLocation('/'); }}>Cancelar</Button>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">Dica: usuário padrão <code>admin</code>/<code>admin</code></div>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

export default LoginPage;
