/* ============ PAGES PUBLIQUES : « ← Revenir à Caramel » ============
   Ouverte depuis Caramel (espace parents) : on revient en arrière, là où on était (l'espace parents reste ouvert
   tant que sa fenêtre de 10 minutes court). Ouverte depuis ailleurs (fiche du store, moteur de recherche) : le lien
   mène à l'accueil de Caramel. Script classique, sans dépendance : la page reste lisible sans lui. */
(function () {
  var back = document.querySelector('.pg-back');
  if (!back) return;
  var fromApp = false;
  try { fromApp = !!document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1; } catch (e) {}
  if (!fromApp) return;
  back.addEventListener('click', function (e) {
    e.preventDefault();
    history.back();
  });
})();
