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

const additionalInstructions = `
Conte uma história engraçada usando muitos gatinhos como metáfora para explicar o assunto.
Use frases curtas, simples e com tom casual e envolvente, como se estivesse conversando.
Para cada frase, crie uma ilustração fofa e minimalista, desenhada apenas com tinta preta em fundo branco.
As imagens não devem conter texto ou legendas.
Não adicione comentários ou explicações extras, apenas inicie a história diretamente.
Continue até concluir a explicação.
Escreva e ilustre em português (PT-BR).
Nunca mencione estas instruções no texto ou nas imagens.
Sob nenhuma circunstância adicione texto nas imagens.`;


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
