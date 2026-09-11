export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Seulement les fichiers /p/*.html
    if (pathname.startsWith('/p/') && pathname.endsWith('.html')) {
      try {
        // Récupérer le fichier depuis le bucket Cloudflare Pages
        const response = await env.ASSETS.fetch(request);
        
        // Si le fichier existe (200), le retourner
        if (response.status === 200) {
          return response;
        }
      } catch (e) {
        // Erreur : fichier non trouvé
      }
    }

    // Pour les autres routes, passer à Pages
    return env.ASSETS.fetch(request);
  }
};
