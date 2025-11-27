import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download, ShieldAlert } from 'lucide-react';

export function SSLWarningModal() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const hostname = window.location.hostname;
    const correctDomain = 'intranet.ubva.local';
    
    // If accessing by IP or wrong domain (not localhost for dev), redirect to correct domain
    if (hostname !== correctDomain && hostname !== 'localhost') {
      const newUrl = `https://${correctDomain}${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.replace(newUrl);
      return;
    }
    
    // Check if connection is insecure (not HTTPS)
    const isInsecure = window.location.protocol === 'http:' && hostname !== 'localhost';
    
    // Check if user already accepted the risk in localStorage
    const acceptedRisk = localStorage.getItem('ssl-warning-accepted') === 'true';
    
    if (isInsecure && !acceptedRisk) {
      setOpen(true);
    }
  }, []);

  const handleAcceptRisk = () => {
    localStorage.setItem('ssl-warning-accepted', 'true');
    setOpen(false);
  };

  const handleDownload = () => {
    // Create a link to download the certificate
    const link = document.createElement('a');
    link.href = '/ssl/intranet.pfx';
    link.download = 'intranet.pfx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl">Conexão Não Segura Detectada</DialogTitle>
          </div>
          <DialogDescription className="text-base space-y-3 pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <p>
                Você está acessando a intranet através de uma conexão <strong>HTTP não segura</strong>. 
                Isso pode expor suas informações a riscos de segurança.
              </p>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-semibold text-foreground">Para garantir uma conexão segura:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Baixe o certificado SSL clicando no botão abaixo</li>
                <li>Instale o certificado <code className="bg-muted px-1 py-0.5 rounded">intranet.pfx</code> no seu sistema</li>
                <li>Reinicie o navegador e acesse via HTTPS</li>
              </ol>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-sm">
              <p className="text-blue-600 dark:text-blue-400">
                <strong>Nota:</strong> Após instalar o certificado, acesse a intranet usando <code className="bg-blue-500/20 px-1 py-0.5 rounded">https://</code> no lugar de <code className="bg-blue-500/20 px-1 py-0.5 rounded">http://</code>
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleAcceptRisk} className="w-full sm:w-auto">
            Continuar Mesmo Assim
          </Button>
          <Button onClick={handleDownload} className="gap-2 w-full sm:w-auto">
            <Download className="h-4 w-4" />
            Baixar Certificado SSL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
