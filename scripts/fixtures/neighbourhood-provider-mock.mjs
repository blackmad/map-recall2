/** Installed only by check-neighbourhood-budget; all network is intercepted. */
import fs from 'node:fs/promises';
globalThis.fetch=async(url,options)=>{
  if(url==='https://openrouter.ai/api/v1/models')return Response.json({data:[{id:'test/model',architecture:{input_modalities:['image']},pricing:{prompt:'0.000001',completion:'0.000002'},supported_parameters:[]}]});
  if(url!=='https://openrouter.ai/api/v1/chat/completions')throw Error('Unexpected network in budget test');
  await fs.appendFile(process.env.NEIGHBOURHOOD_MOCK_LOG,'call\n');
  const request=JSON.parse(options.body),properties=request.response_format.json_schema.schema.properties;
  const proposal=Object.fromEntries(Object.entries(properties).map(([k,v])=>[k,v.enum?.[0]??'']));
  return Response.json({id:'mock-only',usage:process.env.NEIGHBOURHOOD_MOCK_UNKNOWN?{}:{cost:0.034},choices:[{message:{content:JSON.stringify(proposal)}}]});
};
