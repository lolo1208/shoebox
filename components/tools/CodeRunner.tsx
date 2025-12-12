
/// <reference lib="dom" />
import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Terminal, Loader2, Code2, AlertCircle, ChevronDown, Settings2, Plus, X, Copy, Check, Info } from 'lucide-react';
import hljs from 'highlight.js';
import { useLocalStorage } from '../../hooks/useLocalStorage';

// --- Types ---

interface Runtime {
  language: string;
  version: string;
  aliases: string[];
  runtime?: string;
}

interface ExecutionResult {
  run: {
    stdout: string;
    stderr: string;
    output: string;
    code: number;
    signal: string | null;
  };
  language: string;
  version: string;
}

// --- Constants ---

// Languages that typically don't accept standard CLI args in this context
const NO_ARGS_LANGS = ['sql', 'brainfuck', 'befunge93', 'cow', 'jelly', 'rockstar'];

// Language Group Mapping: Map Piston language keys to a Display Group Name
// This allows merging "python" and "python2" into "Python", or "csharp" and "dotnet" into "C#"
const LANGUAGE_GROUPS: Record<string, string> = {
  'python': 'Python',
  'python2': 'Python',
  'c++': 'C++',
  'gcc': 'C++',
  'csharp': 'C#',
  'csharp.net': 'C#',
  'javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'go': 'Go',
  'java': 'Java',
  'rust': 'Rust',
  'php': 'PHP',
  'ruby': 'Ruby',
  'swift': 'Swift',
  'kotlin': 'Kotlin',
  'bash': 'Bash',
  'perl': 'Perl',
  'r': 'R',
  'lua': 'Lua',
  'scala': 'Scala',
  'clojure': 'Clojure',
  'elixir': 'Elixir',
  'haskell': 'Haskell',
  'ocaml': 'OCaml',
  'erlang': 'Erlang',
  'dart': 'Dart',
  'nasm': 'Assembly',
  'nasm64': 'Assembly',
  'c': 'C',
  'basic': 'Visual Basic',
  'basic.net': 'Visual Basic',
  'fsharp': 'F#',
  'fsharp.net': 'F#',
};

// Fallback formatter for languages not in the group map
const formatName = (lang: string) => {
    if (LANGUAGE_GROUPS[lang]) return LANGUAGE_GROUPS[lang];
    return lang.charAt(0).toUpperCase() + lang.slice(1);
};

// Piston language name -> highlight.js language name mapping (if different)
const LANG_MAP: Record<string, string> = {
  'c++': 'cpp',
  'csharp': 'csharp',
  'csharp.net': 'csharp',
  'fsharp': 'fsharp',
  'fsharp.net': 'fsharp',
  'javascript': 'javascript',
  'python2': 'python',
  'python': 'python',
  'basic': 'vbnet',
  'basic.net': 'vbnet',
  'nasm': 'x86asm',
  'nasm64': 'x86asm',
};

// Default examples map (Key is the DISPLAY GROUP NAME)
// Updated for better compatibility (Python 2/3, Node/Deno)
const HELLO_EXAMPLES: Record<string, string> = {
  'Python': `import sys

print("Hello Shoebox")

# Loop and print arguments (Compatible with Py2/Py3)
for i, arg in enumerate(sys.argv[1:]):
    print("Arg {}: {}".format(i+1, arg))`,

  'JavaScript': `console.log("Hello Shoebox");

// Loop and print arguments (Compatible with Node and Deno)
// @ts-ignore
const args = typeof process !== 'undefined' ? process.argv.slice(2) : (typeof Deno !== 'undefined' ? Deno.args : []);

args.forEach((arg, index) => {
    console.log(\`Arg \${index + 1}: \${arg}\`);
});`,

  'TypeScript': `console.log("Hello Shoebox");

let args: string[] = [];

// Detect environment safely without global type issues
// @ts-ignore
const isNode = typeof process !== 'undefined';
// @ts-ignore
const isDeno = typeof Deno !== 'undefined';

if (isNode) {
    // Node.js environment
    // @ts-ignore
    args = process.argv.slice(2);
} else if (isDeno) {
    // Deno environment
    // @ts-ignore
    args = Deno.args;
}

args.forEach((arg: string, index: number) => {
    console.log(\`Arg \${index + 1}: \${arg}\`);
});`,

  'Java': `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello Shoebox");
        
        // Loop arguments
        for (int i = 0; i < args.length; i++) {
            System.out.println("Arg " + (i + 1) + ": " + args[i]);
        }
    }
}`,

  'C': `#include <stdio.h>

int main(int argc, char *argv[]) {
    printf("Hello Shoebox\\n");
    
    // Loop arguments (skipping program name at index 0)
    for(int i = 1; i < argc; i++) {
        printf("Arg %d: %s\\n", i, argv[i]);
    }
    return 0;
}`,

  'C++': `#include <iostream>

int main(int argc, char *argv[]) {
    std::cout << "Hello Shoebox" << std::endl;
    
    // Loop arguments
    for(int i = 1; i < argc; i++) {
        std::cout << "Arg " << i << ": " << argv[i] << std::endl;
    }
    return 0;
}`,

  'Go': `package main

import (
    "fmt"
    "os"
)

func main() {
    fmt.Println("Hello Shoebox")
    
    // Loop arguments (skipping program name)
    for i, arg := range os.Args[1:] {
        fmt.Printf("Arg %d: %s\\n", i+1, arg)
    }
}`,

  'Rust': `use std::env;

fn main() {
    println!("Hello Shoebox");
    
    // Loop arguments (skipping program name)
    for (i, arg) in env::args().skip(1).enumerate() {
        println!("Arg {}: {}", i + 1, arg);
    }
}`,

  'PHP': `<?php
echo "Hello Shoebox\n";

// Loop arguments (skipping script name)
for ($i = 1; $i < $argc; $i++) {
    echo "Arg $i: " . $argv[$i] . "\n";
}`,

  'Ruby': `puts "Hello Shoebox"

# ARGV contains only arguments, not script name
ARGV.each_with_index do |arg, index|
  puts "Arg #{index + 1}: #{arg}"
end`,

  'Swift': `print("Hello Shoebox")

// CommandLine.arguments includes the executable path at index 0
for i in 1..<CommandLine.arguments.count {
    print("Arg \\(i): \\(CommandLine.arguments[i])")
}`,

  'Kotlin': `fun main(args: Array<String>) {
    println("Hello Shoebox")
    
    for (i in args.indices) {
        println("Arg \${i + 1}: \${args[i]}")
    }
}`,

  'C#': `using System;

class Program
{
    public static void Main(string[] args)
    {
        Console.WriteLine("Hello Shoebox");
        
        for (int i = 0; i < args.Length; i++)
        {
            Console.WriteLine($"Arg {i + 1}: {args[i]}");
        }
    }
}`,

  'F#': `open System

[<EntryPoint>]
let main args =
    printfn "Hello Shoebox"
    args |> Array.iteri (fun i arg -> printfn "Arg %d: %s" (i + 1) arg)
    0`,

  'Bash': `echo "Hello Shoebox"

i=1
for arg in "$@"
do
    echo "Arg $i: $arg"
    ((i++))
done`,
  
  'Visual Basic': `Module Program
    Sub Main(args As String())
        Console.WriteLine("Hello Shoebox")
        For i As Integer = 0 To args.Length - 1
            Console.WriteLine("Arg " & (i + 1) & ": " & args(i))
        Next
    End Sub
End Module`,
};

const CodeRunner: React.FC = () => {
  // --- State ---
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [loadingRuntimes, setLoadingRuntimes] = useState(true);
  
  // Persistent Settings
  // selectedGroup stores the Display Name (e.g. "Python", "C#")
  const [selectedGroup, setSelectedGroup] = useLocalStorage<string>('tool-cr-group', 'Python');
  
  // selectedRuntimeKey stores "language:version" to uniquely identify specific runtime
  const [selectedRuntimeKey, setSelectedRuntimeKey] = useState<string>(''); 
  
  const [code, setCode] = useLocalStorage<string>('tool-cr-code', HELLO_EXAMPLES['Python']);
  // Changed from string to string[] for multiple args support
  const [args, setArgs] = useLocalStorage<string[]>('tool-cr-args-list', ['']);
  
  const [output, setOutput] = useState<string>('');
  // New state for execution metadata
  const [executionMeta, setExecutionMeta] = useState<{
      language: string; 
      version: string; 
      run: { code: number; signal: string | null; } 
  } | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [outputCopied, setOutputCopied] = useState(false);

  // Refs for sync scroll
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // --- Derived State ---
  
  // 1. Grouped Languages List
  const availableGroups = React.useMemo(() => {
      const groups = new Set<string>();
      runtimes.forEach(r => {
          groups.add(formatName(r.language));
      });
      
      const list = Array.from(groups);
      const priority = [
          'Python', 'JavaScript', 'TypeScript', 'Java', 'C#', 'C++', 'C', 'Go', 'Rust', 'PHP', 
          'Swift', 'Kotlin', 'Ruby', 'Bash', 'Visual Basic', 'F#'
      ];
      
      return list.sort((a, b) => {
         const idxA = priority.indexOf(a);
         const idxB = priority.indexOf(b);
         if (idxA !== -1 && idxB !== -1) return idxA - idxB;
         if (idxA !== -1) return -1;
         if (idxB !== -1) return 1;
         return a.localeCompare(b);
      });
  }, [runtimes]);

  // 2. Runtimes for Selected Group
  const groupRuntimes = React.useMemo(() => {
      if (!selectedGroup) return [];
      
      // Filter runtimes that match the selected group name
      const matches = runtimes.filter(r => formatName(r.language) === selectedGroup);
      
      // Sort desc by version
      return matches.sort((a, b) => {
          // Parse version numbers like "10.2.0" or "3.10.0"
          // We want higher versions first
          // Handle complex versions somewhat gracefully
          const verA = parseFloat(a.version) || 0;
          const verB = parseFloat(b.version) || 0;
          if (verA !== verB) return verB - verA;
          return b.version.localeCompare(a.version, undefined, { numeric: true });
      });
  }, [runtimes, selectedGroup]);

  // 3. Current Selected Runtime Object
  const activeRuntime = React.useMemo(() => {
      if (!selectedRuntimeKey) return groupRuntimes[0];
      const [lang, ver] = selectedRuntimeKey.split(':');
      return groupRuntimes.find(r => r.language === lang && r.version === ver) || groupRuntimes[0];
  }, [groupRuntimes, selectedRuntimeKey]);

  // Check if args supported based on raw language name
  const supportsArgs = activeRuntime ? !NO_ARGS_LANGS.includes(activeRuntime.language) : true;
  const isSingleVersion = groupRuntimes.length <= 1;

  // --- Effects ---

  // 1. Fetch Runtimes
  useEffect(() => {
    const fetchRuntimes = async () => {
      try {
        const res = await fetch('https://emkc.org/api/v2/piston/runtimes');
        if (!res.ok) throw new Error('Failed to fetch runtimes');
        const data: Runtime[] = await res.json();
        setRuntimes(data);
      } catch (err) {
        setError('无法连接到 Piston API，请检查网络连接。');
      } finally {
        setLoadingRuntimes(false);
      }
    };
    fetchRuntimes();
  }, []);

  // 2. Auto-select version when Group Changes or Runtimes Load
  useEffect(() => {
      if (groupRuntimes.length > 0) {
          // If current selection is invalid for this group, pick the first (best) one
          const currentIsValid = groupRuntimes.some(r => `${r.language}:${r.version}` === selectedRuntimeKey);
          
          if (!currentIsValid) {
              const best = groupRuntimes[0];
              setSelectedRuntimeKey(`${best.language}:${best.version}`);
          }
      } else {
          setSelectedRuntimeKey('');
      }
  }, [groupRuntimes, selectedRuntimeKey]);

  // 3. Handle Group Change Action
  const handleGroupChange = (newGroup: string) => {
      setSelectedGroup(newGroup);
      
      // Auto-fill example
      let example = HELLO_EXAMPLES[newGroup] || `// No example for ${newGroup}\nprint("Hello Shoebox")`;
      
      setCode(example);
      setOutput('');
      setExecutionMeta(null); // Clear previous result
  };

  // --- Helpers ---

  const getHighlightHtml = () => {
      if (!code) return '';
      // Map display group or piston lang to hljs lang
      const pistonLang = activeRuntime?.language || '';
      const hljsLang = LANG_MAP[pistonLang] || pistonLang;
      
      const validLang = hljs.getLanguage(hljsLang) ? hljsLang : 'plaintext';
      try {
          return hljs.highlight(code, { language: validLang }).value;
      } catch (e) {
          return code;
      }
  };

  const handleScroll = () => {
      if (textareaRef.current && preRef.current) {
          preRef.current.scrollTop = textareaRef.current.scrollTop;
          preRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
  };

  // --- Arg Handlers ---
  const handleArgChange = (index: number, value: string) => {
      const newArgs = [...args];
      newArgs[index] = value;
      setArgs(newArgs);
  };

  const addArg = () => {
      setArgs([...args, '']);
  };

  const removeArg = (index: number) => {
      if (args.length <= 1) {
          setArgs(['']); // Don't remove last one, just clear it
      } else {
          const newArgs = args.filter((_, i) => i !== index);
          setArgs(newArgs);
      }
  };

  const runCode = async () => {
      if (!code.trim()) return;
      if (!activeRuntime) {
          setOutput('Error: No runtime selected.');
          return;
      }

      setIsRunning(true);
      setOutput('');
      setExecutionMeta(null);
      
      try {
          const finalArgs = args.filter(a => a !== '');

          // Helper to determine proper file name/extension based on language
          // This is critical for Deno/TS to correctly parse types
          const getFileName = (lang: string) => {
              // Priority: Check selected group first to handle ambiguous cases (like Deno running as TypeScript)
              if (selectedGroup === 'TypeScript') return 'main.ts';
              if (selectedGroup === 'C++') return 'main.cpp';
              if (selectedGroup === 'C#') return 'Program.cs';
              if (selectedGroup === 'Visual Basic') return 'main.vb';
              if (selectedGroup === 'F#') return 'main.fs';

              const map: Record<string, string> = {
                  'java': 'Main.java',
                  'javascript': 'main.js',
                  'python': 'main.py',
                  'c': 'main.c',
                  'go': 'main.go',
                  'rust': 'main.rs',
                  'swift': 'main.swift',
                  'kotlin': 'main.kt',
                  'php': 'main.php',
                  'ruby': 'main.rb',
                  'bash': 'main.sh',
                  'perl': 'main.pl',
                  'r': 'main.r',
                  'lua': 'main.lua',
                  'scala': 'main.scala',
                  'dart': 'main.dart',
                  'elixir': 'main.exs',
                  'clojure': 'main.clj',
              };
              return map[lang] || 'main.code';
          };

          const res = await fetch('https://emkc.org/api/v2/piston/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  language: activeRuntime.language,
                  version: activeRuntime.version,
                  args: finalArgs,
                  files: [
                      {
                          name: getFileName(activeRuntime.language),
                          content: code
                      }
                  ]
              })
          });

          if (!res.ok) throw new Error(`Execution failed: ${res.statusText}`);
          
          const result: ExecutionResult = await res.json();
          setOutput(result.run.output || (result.run.stderr ? `Error:\n${result.run.stderr}` : 'No output'));
          
          // Store full execution details
          setExecutionMeta({
              language: result.language,
              version: result.version,
              run: {
                  code: result.run.code,
                  signal: result.run.signal
              }
          });

      } catch (err: any) {
          setOutput(`Execution Error: ${err.message}`);
      } finally {
          setIsRunning(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
          e.preventDefault();
          const target = e.target as HTMLTextAreaElement;
          const start = target.selectionStart;
          const end = target.selectionEnd;
          const spaces = "    ";
          const newCode = code.substring(0, start) + spaces + code.substring(end);
          setCode(newCode);
          setTimeout(() => {
              target.selectionStart = target.selectionEnd = start + spaces.length;
          }, 0);
      }
  };

  const copyOutput = () => {
      if (!output) return;
      navigator.clipboard.writeText(output);
      setOutputCopied(true);
      setTimeout(() => setOutputCopied(false), 2000);
  };

  const getVersionLabel = (r: Runtime, allRuntimes: Runtime[]) => {
      const isUnique = allRuntimes.filter(x => x.version === r.version).length === 1;
      let label = `v${r.version}`;
      if (r.runtime) {
          label += ` (${r.runtime})`;
      } else if (r.language !== selectedGroup.toLowerCase() && r.language !== selectedGroup.toLowerCase().replace('#', 'sharp')) {
          label += ` (${r.language})`;
      }
      return label;
  };

  return (
    <div className="flex flex-col h-full gap-4">
       {/* Toolbar */}
       <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
           {/* Row 1: Language & Version */}
           <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 min-w-[240px]">
                    <div className="text-gray-400 shrink-0 px-1 hover:text-primary-600 transition-colors" title="选择运行环境">
                        <Code2 size={18} />
                    </div>
                    
                    {loadingRuntimes ? (
                        <div className="flex gap-2 w-full">
                            <div className="h-9 flex-1 bg-gray-100 rounded animate-pulse"></div>
                            <div className="h-9 w-24 bg-gray-100 rounded animate-pulse"></div>
                        </div>
                    ) : (
                        <div className="flex gap-2 flex-1">
                            {/* Language Selector */}
                            <div className="relative group flex-1">
                                <select 
                                    value={selectedGroup}
                                    onChange={(e) => handleGroupChange(e.target.value)}
                                    className="appearance-none w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2 pr-8 font-medium cursor-pointer"
                                >
                                    {availableGroups.map(group => (
                                        <option key={group} value={group}>
                                            {group}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-2.5 text-gray-400 pointer-events-none group-hover:text-primary-600" size={16} />
                            </div>

                            {/* Version Selector */}
                            <div className="relative group w-40 shrink-0">
                                <select 
                                    value={selectedRuntimeKey}
                                    onChange={(e) => setSelectedRuntimeKey(e.target.value)}
                                    disabled={isSingleVersion}
                                    className={`
                                        appearance-none w-full border text-xs rounded-lg block p-2.5 pr-6 font-mono transition-colors
                                        ${isSingleVersion 
                                            ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-default select-none' 
                                            : 'bg-gray-50 text-gray-600 border-gray-200 focus:ring-primary-500 focus:border-primary-500 cursor-pointer'}
                                    `}
                                    title={isSingleVersion ? "当前语言仅提供此版本" : "选择运行时版本"}
                                >
                                    {groupRuntimes.map(r => (
                                        <option key={`${r.language}:${r.version}`} value={`${r.language}:${r.version}`}>
                                            {getVersionLabel(r, groupRuntimes)}
                                        </option>
                                    ))}
                                </select>
                                {!isSingleVersion && (
                                    <ChevronDown className="absolute right-1.5 top-3 text-gray-400 pointer-events-none group-hover:text-primary-600" size={14} />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

                {/* Args Input - Dynamic List */}
                <div className="flex-1 min-w-[200px] flex items-center">
                    <div className="text-gray-400 shrink-0 mr-2 hover:text-primary-600 transition-colors" title="命令行参数配置">
                        <Settings2 size={18} className={`${supportsArgs ? '' : 'text-gray-300'}`} />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 w-full">
                        {supportsArgs ? (
                            <>
                                {args.map((arg, index) => (
                                    <div key={index} className="relative group/input flex items-center max-w-[150px] min-w-[100px] flex-1">
                                        <input 
                                            type="text" 
                                            value={arg}
                                            onChange={(e) => handleArgChange(index, e.target.value)}
                                            placeholder={`Arg ${index + 1}`}
                                            title={`命令行参数 ${index + 1}`}
                                            className="w-full text-sm py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors font-mono text-gray-700 pr-7"
                                        />
                                        {(args.length > 1 || arg) && (
                                            <button 
                                                onClick={() => removeArg(index)}
                                                className="absolute right-1.5 p-0.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                tabIndex={-1}
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={addArg}
                                    className="p-1.5 bg-gray-50 border border-gray-200 text-gray-500 rounded-lg hover:bg-primary-50 hover:text-primary-600 hover:border-primary-200 transition-colors"
                                    title="添加参数"
                                >
                                    <Plus size={14} />
                                </button>
                            </>
                        ) : (
                            <div className="text-sm text-gray-300 italic select-none border border-transparent py-1.5">
                                该语言不支持命令行参数
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-auto shrink-0">
                    <button
                        onClick={() => {
                            if (selectedGroup) {
                                handleGroupChange(selectedGroup);
                            }
                            setArgs(['']);
                        }}
                        className="p-2.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="重置代码与参数"
                    >
                        <RotateCcw size={18} />
                    </button>
                    <button 
                        onClick={runCode}
                        disabled={isRunning || loadingRuntimes}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95 font-bold whitespace-nowrap"
                    >
                        {isRunning ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />}
                        {isRunning ? '运行中' : '运行'}
                    </button>
                </div>
           </div>
       </div>

       {/* Main Area */}
       <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[500px]">
           
           {/* Editor */}
           <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm relative group">
               <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-400 to-primary-600 opacity-0 group-hover:opacity-100 transition-opacity z-20"></div>
               
               {/* Editor Container */}
               <div className="flex-1 relative font-mono text-sm">
                   {/* Highlight Layer */}
                   <pre 
                       ref={preRef}
                       className="absolute inset-0 p-4 m-0 overflow-auto pointer-events-none whitespace-pre z-0"
                       aria-hidden="true"
                   >
                       <code 
                           className={`hljs language-${LANG_MAP[activeRuntime?.language] || activeRuntime?.language}`}
                           dangerouslySetInnerHTML={{ __html: getHighlightHtml() + '<br/>' }} 
                           style={{ fontFamily: 'inherit', background: 'transparent', padding: 0 }}
                       />
                   </pre>

                   {/* Input Layer */}
                   <textarea
                       ref={textareaRef}
                       value={code}
                       onChange={(e) => setCode(e.target.value)}
                       onScroll={handleScroll}
                       onKeyDown={handleKeyDown}
                       spellCheck={false}
                       className="absolute inset-0 w-full h-full p-4 m-0 resize-none overflow-auto whitespace-pre bg-transparent text-transparent caret-gray-900 border-none outline-none z-10 font-mono focus:ring-0"
                       style={{ color: 'transparent', background: 'transparent' }} // Extra safety
                   />
               </div>
               
               <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 text-xs text-gray-400 flex justify-between items-center">
                   <span>Line {code.split('\n').length}</span>
                   <span className="font-mono">{activeRuntime?.language} v{activeRuntime?.version}</span>
               </div>
           </div>

           {/* Output Terminal - Wider on Large Screens */}
           <div className="h-64 lg:h-auto lg:w-[40%] shrink-0 bg-[#1e1e1e] rounded-xl overflow-hidden flex flex-col shadow-inner border border-gray-800">
               <div className="bg-[#252526] px-4 py-3 flex items-center justify-between border-b border-[#333]">
                   <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                       <Terminal size={14} />
                       Console Output
                   </span>
                   <div className="flex items-center gap-3">
                       {isRunning && <Loader2 className="animate-spin text-primary-500" size={14} />}
                       {output && (
                           <button 
                               onClick={copyOutput} 
                               className={`p-1.5 rounded transition-all ${outputCopied ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                               title="复制输出"
                           >
                               {outputCopied ? <Check size={14} /> : <Copy size={14} />}
                           </button>
                       )}
                   </div>
               </div>
               
               <div className="flex-1 p-4 overflow-auto custom-scrollbar-dark font-mono text-sm relative">
                   {error ? (
                       <div className="text-red-400 flex items-start gap-2">
                           <AlertCircle size={16} className="mt-0.5 shrink-0" />
                           {error}
                       </div>
                   ) : output ? (
                       <pre className="text-gray-300 whitespace-pre-wrap break-all pb-6">{output}</pre>
                   ) : (
                       <div className="text-gray-600 italic select-none">等待运行...</div>
                   )}
               </div>

               {/* Execution Metadata Footer */}
               {executionMeta && (
                   <div className="bg-[#252526] px-3 py-1.5 border-t border-[#333] flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono select-text items-center">
                       <div className="text-gray-400">
                           <span className="text-gray-500 mr-1">Language:</span>
                           {executionMeta.language} {executionMeta.version}
                       </div>
                       
                       <div className={`flex items-center gap-1.5 ${executionMeta.run.code === 0 ? 'text-green-500' : 'text-red-400'}`}>
                           <span className="text-gray-500">Exit:</span>
                           {executionMeta.run.code}
                       </div>

                       {executionMeta.run.signal && (
                           <div className="text-amber-500">
                               <span className="text-gray-500 mr-1">Signal:</span>
                               {executionMeta.run.signal}
                           </div>
                       )}
                   </div>
               )}
           </div>
       </div>
    </div>
  );
};

export default CodeRunner;
