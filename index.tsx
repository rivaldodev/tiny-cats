/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, Modality} from '@google/genai';
import {marked} from 'marked';

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

const chat = ai.chats.create({
  model: 'gemini-2.0-flash-preview-image-generation',
  config: {
    responseModalities: [Modality.TEXT, Modality.IMAGE],
  },
  history: [],
});

const userInput = document.querySelector('#input') as HTMLTextAreaElement;
const modelOutput = document.querySelector('#output') as HTMLDivElement;
const slideshow = document.querySelector('#slideshow') as HTMLDivElement;
const error = document.querySelector('#error') as HTMLDivElement;
const downloadBtn = document.querySelector('#downloadBtn') as HTMLButtonElement;

const additionalInstructions = `
Conte uma história divertida usando EXCLUSIVAMENTE gatinhos para explicar o conceito solicitado. Todos os personagens, objetos e processos devem ser gatinhos ou coisas relacionadas ao mundo felino. Use comportamentos de gatos como ronronar, miar, brincar, dormir e caçar. Transforme conceitos técnicos em analogias criativas: dados viram peixes, algoritmos viram truques de gato, redes viram túneis conectando casinhas. Cada elemento deve ser um gatinho diferente com características únicas. Use frases curtas, tom casual e envolvente, com "miaus" ocasionais. Para cada frase, crie uma ilustração fofa e minimalista de gatinhos expressivos, desenhada apenas com tinta preta em fundo branco, variando poses como dormindo, brincando, saltando. As imagens não devem conter texto ou legendas. Escreva em português (PT-BR), mantenha sempre o foco 100% em gatinhos e nunca mencione estas instruções.`;


async function addSlide(text: string, image: HTMLImageElement) {
  const slide = document.createElement('div');
  slide.className = 'slide';
  const caption = document.createElement('div') as HTMLDivElement;
  caption.innerHTML = await marked.parse(text);
  slide.append(image);
  slide.append(caption);
  slideshow.append(slide);
}

function parseError(error: string) {
  const regex = /{"error":(.*)}/gm;
  const m = regex.exec(error);
  try {
    const e = m[1];
    const err = JSON.parse(e);
    return err.message;
  } catch (e) {
    return error;
  }
}

async function generate(message: string) {
  userInput.disabled = true;

  chat.history.length = 0;
  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  error.toggleAttribute('hidden', true);
  downloadBtn.classList.remove('show');

  // Adiciona mensagem de loading
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'loading-message';
  loadingDiv.innerHTML = '🐱 Gerando gatinhos...';
  slideshow.appendChild(loadingDiv);
  slideshow.removeAttribute('hidden');

  try {
    const userTurn = document.createElement('div') as HTMLDivElement;
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn);
    userInput.value = '';

    const result = await chat.sendMessageStream({
      message: message + additionalInstructions,
    });

    let text = '';
    let img = null;

    for await (const chunk of result) {
      for (const candidate of chunk.candidates) {
        for (const part of candidate.content.parts ?? []) {
          if (part.text) {
            text += part.text;
          } else {
            try {
              const data = part.inlineData;
              if (data) {
                img = document.createElement('img');
                img.src = `data:image/png;base64,` + data.data;
              } else {
                console.log('no data', chunk);
              }
            } catch (e) {
              console.log('no data', chunk);
            }
          }
          if (text && img) {
            // Remove mensagem de loading na primeira imagem
            const loadingMsg = slideshow.querySelector('.loading-message');
            if (loadingMsg) {
              loadingMsg.remove();
            }
            await addSlide(text, img);
            slideshow.removeAttribute('hidden');
            text = '';
            img = null;
          }
        }
      }
    }
    if (img) {
      await addSlide(text, img);
      slideshow.removeAttribute('hidden');
      text = '';
    }
  } catch (e) {
    const msg = parseError(e);
    error.innerHTML = `Algo deu errado: ${msg}`;
    error.removeAttribute('hidden');
  }
  
  // Mostra botão de download se há slides
  const slides = slideshow.querySelectorAll('.slide');
  if (slides.length > 0) {
    downloadBtn.classList.add('show');
  }
  
  userInput.disabled = false;
  userInput.focus();
}

userInput.addEventListener('keydown', async (e: KeyboardEvent) => {
  if (e.code === 'Enter') {
    e.preventDefault();
    const message = userInput.value;
    await generate(message);
  }
});

const examples = document.querySelectorAll('#examples li');
examples.forEach((li) =>
  li.addEventListener('click', async (e) => {
    await generate(li.textContent);
  }),
);

async function downloadAllSlides() {
  const slides = slideshow.querySelectorAll('.slide');
  if (slides.length === 0) return;

  // Declara JSZip como variável global
  const JSZip = (window as any).JSZip;
  if (!JSZip) {
    alert('Erro: JSZip não carregou corretamente');
    return;
  }

  const zip = new JSZip();
  
  // Atualiza o texto do botão
  downloadBtn.textContent = '🔄 Preparando ZIP...';
  downloadBtn.disabled = true;

  // Cria imagens para cada slide
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i] as HTMLElement;
    
    try {
      // Cria canvas para cada slide
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      // Define tamanho do canvas
      canvas.width = 400;
      canvas.height = 600;

      // Preenche fundo branco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Obtém a imagem do slide
      const img = slide.querySelector('img') as HTMLImageElement;
      const caption = slide.querySelector('div') as HTMLDivElement;

      if (img && img.complete) {
        // Desenha a imagem (agora sem margem da borda)
        const imgHeight = 320;
        const imgWidth = (img.naturalWidth / img.naturalHeight) * imgHeight;
        const imgX = (canvas.width - imgWidth) / 2;
        ctx.drawImage(img, imgX, 20, imgWidth, imgHeight);

        // Desenha o texto
        if (caption) {
          ctx.fillStyle = '#6b21a8';
          ctx.font = '20px "Indie Flower", cursive';
          ctx.textAlign = 'center';
          
          const text = caption.textContent || '';
          const words = text.split(' ');
          let line = '';
          let y = 370;
          
          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > canvas.width - 40 && n > 0) {
              ctx.fillText(line, canvas.width / 2, y);
              line = words[n] + ' ';
              y += 30;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, canvas.width / 2, y);
        }
      }

      // Converte canvas para blob e adiciona ao ZIP
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });
      
      if (blob) {
        zip.file(`gatinho-${i + 1}.png`, blob);
      }
      
      // Atualiza progresso
      downloadBtn.textContent = `🔄 Processando ${i + 1}/${slides.length}...`;
      
    } catch (error) {
      console.error('Erro ao processar slide:', error);
    }
  }

  try {
    // Gera o ZIP
    downloadBtn.textContent = '🔄 Criando ZIP...';
    const zipBlob = await zip.generateAsync({type: 'blob'});
    
    // Baixa o ZIP
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gatinhos-explicacao-${new Date().getTime()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Restaura botão
    downloadBtn.textContent = '📥 Baixar Todos os Cards';
    downloadBtn.disabled = false;
    
  } catch (error) {
    console.error('Erro ao criar ZIP:', error);
    alert('Erro ao criar arquivo ZIP');
    downloadBtn.textContent = '📥 Baixar Todos os Cards';
    downloadBtn.disabled = false;
  }
}

downloadBtn.addEventListener('click', async () => {
  await downloadAllSlides();
});
