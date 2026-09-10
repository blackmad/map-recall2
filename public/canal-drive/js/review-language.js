/** Display copy only: saved field names and values remain backward-compatible. */
export const REVIEW_QUESTIONS={
  shopfront:{question:'Is there a shop or business at street level?',help:'Look for a shop window, counter, sign or customer entrance. A normal front door alone is not a shop.',options:{unknown:"Can't tell",yes:'Yes',no:'No'}},
  awning:{question:'Is a fabric sunshade sticking out?',help:'A fabric cover extended over the pavement, window or doorway. Rolled-up fabric alone does not count as sticking out.',options:{unknown:"Can't tell",yes:'Yes',no:'No'}},
  awningKind:{question:'What kind of cover is above the entrance or windows?',help:'Fabric can fold or roll up. A solid cover is fixed, such as glass, metal or tiles. Ignore balconies and the main roof.',options:{unknown:"Can't tell",fabric:'Fabric awning',rigid:'Solid cover',mixed:'Both fabric and solid',none:'No cover'}},
  awningDeployment:{question:'Is the fabric awning open or rolled up?',help:'Describe its position in the photo, not how it might look on another day. For a solid cover or no awning, choose “No fabric awning”.',options:{unknown:"Can't tell",deployed:'Open / sticking out',retracted:'Rolled or folded up',mixed:'Some open, some rolled up','not-applicable':'No fabric awning'}},
  roofShape:{question:'What shape is the roof behind the front wall?',help:'Use the street and overhead photos. This is the roof covering the building, not the decorative outline facing the street. If it is hidden, leave “Can’t see enough”.',options:{unknown:"Can't see enough",flat:'Flat roof','pitched-gable':'Two slopes meeting at a ridge',hipped:'Slopes on all sides',mansard:'Steep lower slopes, gentler top',complex:'Several different roof shapes','flat-with-front-pitch':'Flat roof with a sloped front section'}},
  facadeTop:{question:'What shape is the top edge of the front wall?',help:'Follow the street-facing wall upward, above the highest windows. A stepped or pointed front can hide a flat roof behind it.',options:{unknown:"Can't see enough",straight:'Straight / level',stepped:'Stair-step outline',bell:'Curved, bell-like shoulders',neck:'Narrow raised middle',pointed:'Triangle / pointed top'}},
};

export function explainReviewQuestions(document){
  for(const [id,{question,help,options}] of Object.entries(REVIEW_QUESTIONS)){
    const select=document.getElementById(id),row=select.closest('label');
    const copy=document.createElement('span');copy.className='question-copy';
    const title=document.createElement('span');title.className='question-title';title.textContent=question;
    const hint=document.createElement('small');hint.className='question-help';hint.id=id+'-help';hint.textContent=help;
    copy.append(title,hint);row.replaceChildren(copy,select);row.classList.add('explained-task');
    select.setAttribute('aria-label',question);select.setAttribute('aria-describedby',hint.id);
    for(const option of select.options){const value=option.value;option.value=value;option.textContent=options[value]||value;}
  }
  const introduction=document.createElement('p');introduction.className='hint';introduction.id='appearance-help';
  introduction.textContent='Describe only what you can see. “Can’t tell” is a useful answer; you do not need to know building styles. If no option fits, describe it in the notes.';
  document.querySelector('#appearance h3').after(introduction);
  const guide=document.createElement('details');guide.className='shape-guide';
  const summary=document.createElement('summary');summary.textContent='Show examples of front-wall outlines';guide.append(summary);
  const note=document.createElement('p');note.className='hint';note.textContent='Generic outlines—not suggestions for this building. These show the front wall, not the roof behind it.';guide.append(note);
  const examples=document.createElement('div');examples.className='shape-examples';
  const paths={straight:'M10 65 V20 H70 V65',stepped:'M10 65 V40 H20 V30 H30 V20 H50 V30 H60 V40 H70 V65',bell:'M10 65 V45 C25 45 22 20 35 20 H45 C58 20 55 45 70 45 V65',neck:'M10 65 V42 H27 V17 H53 V42 H70 V65',pointed:'M10 65 V43 L40 15 L70 43 V65'};
  for(const [value,d] of Object.entries(paths)){
    const figure=document.createElement('figure'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');
    svg.setAttribute('viewBox','0 0 80 75');svg.setAttribute('aria-hidden','true');path.setAttribute('d',d);svg.append(path);
    const caption=document.createElement('figcaption');caption.textContent=REVIEW_QUESTIONS.facadeTop.options[value];figure.append(svg,caption);examples.append(figure);
  }
  guide.append(examples);document.getElementById('facadeTop').closest('label').after(guide);
  const notes=document.getElementById('review-notes');notes.placeholder='For example: right building, but the top is cut off in this photo.';
  notes.previousSibling.textContent='Anything else you notice? ';
}
