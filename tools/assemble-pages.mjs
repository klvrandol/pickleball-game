// Assemble an Actions Pages artifact without deleting the existing preview or legacy files.
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readdirSync,readFileSync,cpSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
const output=process.argv[2]??'pages-site';assert(!existsSync(output),'Choose a new output directory.');
execFileSync(process.execPath,['tools/check-pages-assets.mjs'],{stdio:'inherit'});
git(['fetch','origin','refs/heads/gh-pages:refs/remotes/origin/gh-pages']);
const previous=git(['rev-parse','origin/gh-pages']),previewTree=git(['rev-parse',`${previous}:doubles-preview`]);
mkdirSync(output,{recursive:true});
const archive=execFileSync('git',['archive',previous],{maxBuffer:128*1024*1024});
execFileSync('tar',['-xf','-','-C',output],{input:archive});
function fingerprint(directory){const hash=createHash('sha256');function visit(dir,prefix=''){for(const name of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(dir,name.name),relative=prefix+name.name;if(name.isDirectory())visit(file,relative+'/');else{assert(name.isFile(),'No symlinks in preview');hash.update(relative+'\0');hash.update(readFileSync(file));}}}visit(directory);return hash.digest('hex');}
const before=fingerprint(path.join(output,'doubles-preview'));
for(const entry of readdirSync('dist')){assert.notEqual(entry,'doubles-preview');cpSync(path.join('dist',entry),path.join(output,entry),{recursive:true,force:true});}
assert.equal(fingerprint(path.join(output,'doubles-preview')),before);
writeFileSync(path.join(output,'.nojekyll'),'');
writeFileSync(path.join(output,'deploy-info.json'),JSON.stringify({sourceCommit:git(['rev-parse','HEAD']),previousPagesCommit:previous,previewTree,base:'/pickleball-game/',workflow:'deploy-pages.yml',builtAt:new Date().toISOString()},null,2)+'\n');
console.log(`PASS assembled ${output}: full root build and byte-identical existing doubles-preview`);
