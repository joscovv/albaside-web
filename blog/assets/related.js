// Arma "Quizás te interese" / "You may also like" al pie de cada post, a partir de posts.js.
// Primero posts del mismo idioma y misma etiqueta; si no alcanzan 3, completa con otros del mismo idioma.
(function(){
  var box = document.getElementById('related');
  if(!box || !window.ALBASIDE_POSTS) return;
  var lang = document.documentElement.lang === 'en' ? 'en' : 'es';
  var here = location.pathname.replace(/\.html$/,'').replace(/\/$/,'');
  var tag = box.getAttribute('data-tag') || '';
  var pool = window.ALBASIDE_POSTS.filter(function(p){ return p.lang === lang && p.url !== here; });
  var same = pool.filter(function(p){ return p.tag === tag; });
  var rest = pool.filter(function(p){ return p.tag !== tag; });
  var picks = same.concat(rest).slice(0,3);
  if(!picks.length){ box.remove(); return; }
  var esc = function(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  var title = lang === 'en' ? 'You may also like' : 'Quizás te interese';
  box.innerHTML = '<div class="wrap"><h2>'+title+'</h2><div class="cards">' + picks.map(function(p){
    return '<a class="card" href="'+p.url+'"><img loading="lazy" alt="'+esc(p.title)+'" src="https://res.cloudinary.com/f3h66ynr/image/upload/q_auto,f_auto,w_600,h_450,c_fill,g_auto/'+p.img+'">'+
      '<div><span>'+esc(p.tag)+'</span><h3>'+esc(p.title)+'</h3><p>'+esc(p.summary)+'</p></div></a>';
  }).join('') + '</div></div>';
})();
