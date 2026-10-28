# MILO — prototype conversationnel

Une première version mobile-first de MILO, en français. Elle inclut :
- choix d'humeur ;
- prénom facultatif ;
- interface de chat adaptée au téléphone ;
- réponses de démonstration locales, sans compte et sans base de données ;
- endpoint IA facultatif pour un déploiement Vercel.

## Tester immédiatement sur un ordinateur
Ouvrez `index.html` dans un navigateur récent. Le mode démonstration fonctionne sans clé API ni installation.

## Tester sur téléphone
Pour le partager par un lien, déployez le dossier sur un hébergeur statique (par exemple Netlify ou Vercel). Le fichier `index.html` fonctionne en mode démo même sans endpoint IA.

## Activer les réponses IA réelles (optionnel)
1. Déployez ce dossier sur Vercel.
2. Dans les paramètres du projet Vercel, ajoutez la variable secrète `OPENAI_API_KEY`.
3. Redéployez le projet.
4. L'endpoint `api/chat.js` sera alors utilisé par le site. Sans clé ou en cas d'erreur, la démo revient automatiquement aux réponses locales.

Ne placez JAMAIS la clé API dans `index.html`. Les appels API peuvent engendrer des frais. Fixez des limites de dépenses côté fournisseur et vérifiez les prix actuels avant d'activer cette option.

## Important avant une diffusion publique
Ceci est un prototype, pas un service de santé ni une application prête pour un déploiement à grande échelle. Avant d'inviter le public :
- ajoutez une politique de confidentialité claire ;
- mettez en place une limitation de débit et une protection anti-abus sur l'endpoint ;
- configurez des plafonds de dépenses et une surveillance des erreurs ;
- vérifiez la sécurité et les règles applicables aux mineurs et aux données personnelles ;
- testez les réponses de sécurité et les cas sensibles ;
- indiquez clairement que MILO est une IA.

Le prototype ne conserve pas la conversation sur un compte. N'ajoutez pas de stockage d'historique sans expliquer clairement ce qui est stocké, pourquoi et pendant combien de temps.
