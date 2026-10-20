import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
export const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
export function cloudAdmin() {
  // CLI credentials are used only in memory; never echo the key response.
  const output = execFileSync('rtk', ['proxy','npx','supabase','projects','api-keys','--project-ref',projectRef,'--reveal','--output','json'], { encoding:'utf8', windowsHide:true, stdio:['ignore','pipe','pipe'] });
  const keys = JSON.parse(output);
  const key = keys.find((key) => key.type === 'secret')?.api_key || keys.find((key) => key.name === 'service_role')?.api_key;
  if (!key) throw new Error('The signed-in Supabase CLI did not return an admin API key.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function check(result, label='Cloud operation') {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
