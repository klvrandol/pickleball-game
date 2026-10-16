// Publish a complete root build while retaining every existing Pages file and preview.
// Default is a local dry run. --publish is an explicit remote deployment request.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,lstatSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const run=(args,options={})=>execFileSync('git',args,{encoding:'utf8',...options}).trim();
assert.equal(run(['status','--porcelain']), '', 'Commit or preserve source changes before publishing.');
const source=run(['rev-parse','HEAD']);
run(['fetch','origin','refs/heads/gh-pages:refs/remotes/origin/gh-pages']);
const parent=run(['rev-parse','origin/gh-pages']);
const preview=run(['rev-parse',`${parent}:doubles-preview`]);
const backup=`pages-before-root-${parent.slice(0,12)}`;
const temp=mkdtempSync(path.join(tmpdir(),'pickle-pages-publish-'));
const env={...process.env,GIT_INDEX_FILE:path.join(temp,'index')};
const args=process.argv.slice(2),rollback=args.indexOf('--rollback');
try{
 let tree;
 if(rollback>=0){
  const tag=args[rollback+1];assert.match(tag??'',/^pages-before-root-[0-9a-f]{12}$/,'Use a recorded Pages backup tag.');
  tree=run(['rev-parse',`${tag}^{tree}`]);
 }else{
  execFileSync(process.execPath,['tools/check-pages-assets.mjs'],{stdio:'inherit'});
  run(['read-tree',parent],{env});
  function add(file,bytes){
   assert(!file.startsWith('doubles-preview/'),'Preview files must not be overwritten.');
   const blob=run(['hash-object','-w','--stdin'],{input:bytes});
   run(['update-index','--add','--cacheinfo',`100644,${blob},${file}`],{env});
  }
  function overlay(directory,relative=''){
   for(const name of readdirSync(directory).sort()){
    const absolute=path.join(directory,name),file=relative+name;
    assert(!lstatSync(absolute).isSymbolicLink(),'No symlinks in Pages artifacts.');
    if(lstatSync(absolute).isDirectory())overlay(absolute,file+'/');else add(file,readFileSync(absolute));
   }
  }
  overlay('dist');add('.nojekyll',Buffer.from(''));
  const info={sourceCommit:source,previousPagesCommit:parent,previewTree:preview,base:'/pickleball-game/',builtAt:new Date().toISOString()};
  add('deploy-info.json',Buffer.from(JSON.stringify(info,null,2)+'\n'));
  tree=run(['write-tree'],{env});
  assert.equal(run(['rev-parse',`${tree}:doubles-preview`]),preview,'Preview tree changed.');
  assert.equal(run(['diff','--name-only','--diff-filter=D',parent,tree]),'','Existing files were removed.');
 }
 const report={sourceCommit:source,previousPagesCommit:parent,backupTag:backup,tree,previewPreserved:run(['rev-parse',`${tree}:doubles-preview`])===preview};
 if(!args.includes('--publish')){console.log(JSON.stringify({dryRun:true,...report},null,2));}
 else{
  let existing;try{existing=run(['rev-parse','--verify','--quiet',`${backup}^{commit}`]);}catch{}
  if(existing)assert.equal(existing,parent,'Backup tag already belongs to a different commit.');
  else run(['tag','-a',backup,parent,'-m',`Preserve working root and doubles-preview before root promotion from ${source}`]);
  run(['push','origin',`refs/tags/${backup}`]); // Backup must exist remotely before site changes.
  const message=rollback>=0?`Restore Pages from ${args[rollback+1]}`:`Publish complete PICKLE COURT root from ${source}; retain doubles-preview`;
  const commit=run(['commit-tree',tree,'-p',parent],{input:message+'\n'});
  // Normal fast-forward push: a concurrent deployment rejects this instead of being overwritten.
  run(['push','origin',`${commit}:refs/heads/gh-pages`]);
  console.log(JSON.stringify({published:true,pagesCommit:commit,...report},null,2));
 }
}finally{rmSync(temp,{recursive:true,force:true});}
