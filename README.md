# QUAKE CLONE — O Pesadelo Começa

Um jogo de tiro em primeira pessoa no navegador, inspirado no **Quake** (id Software, 1996): corredores escuros de pedra, monstros grotescos, armas pesadas, rocket jump e uma trilha sonora sombria. Tudo roda em JavaScript puro com [Three.js](https://threejs.org/), sem instalação, sem build e **sem nenhum arquivo de imagem ou som**: texturas, modelos 3D, efeitos sonoros e música são gerados por código.

> **Este jogo foi criado inteiramente pelo Claude (modelo Claude Sonnet 5.5, da Anthropic), usando o Claude Code**, a partir de pedidos em linguagem natural feitos por um usuário. Todo o código, as texturas procedurais, os modelos 3D e o áudio sintetizado foram escritos pelo Claude ao longo da conversa.

> Projeto de fã, sem fins comerciais e sem vínculo com a id Software ou a Bethesda. "Quake" é marca de seus respectivos titulares. Nenhum asset original foi usado.

---

## Como jogar

É preciso internet apenas para carregar o Three.js pela CDN (jsDelivr).

**Opção 1 — abrir direto:** dê dois cliques em `index.html` (Chrome ou Edge recomendados).

**Opção 2 — servidor local** (recomendado, evita restrições do navegador com arquivos locais):

```bash
python -m http.server 8123
```

Depois abra <http://localhost:8123>.

Escolha a dificuldade e clique na tela para capturar o mouse. O áudio só começa depois do primeiro clique (regra dos navegadores).

## Controles

| Ação | Tecla |
|---|---|
| Mover | `W` `A` `S` `D` (ou setas) |
| Mirar | Mouse |
| Atirar | Botão esquerdo do mouse |
| Pular | `Espaço` (segure para *bunny hop*) |
| Andar devagar | `Shift` |
| Trocar de arma | `1`–`6`, roda do mouse ou `Q` |
| Usar (abrir paredes secretas) | `E` |
| Pausar | `Esc` |

Sensibilidade, campo de visão, volume, música e inversão do mouse ficam no menu inicial.

**Dicas:** pule e gire o mouse no ar para ganhar velocidade (*strafe jump*). Atire um foguete no chão aos seus pés para um *rocket jump*. Procure paredes suspeitas e aperte `E` para achar segredos.

## O que tem no jogo

- **4 fases**, cada uma com tema próprio: *O Complexo Slipgate* (tech), *Castelo dos Condenados* (castelo), *A Necrópole* (frio e azulado) e *Covil de Chthon* (inferno com lava).
- **Fases geradas por código** (salas, corredores, portas, pilares, poços de lava, segredos) com uma semente fixa por fase, então o layout é sempre o mesmo.
- **Objetivo:** achar a **chave** da fase, abrir a porta trancada e chegar ao **portal de saída**. Na última fase é preciso derrotar o chefe **Chthon** para o portal abrir.
- **6 armas:** machado, escopeta, escopeta dupla, nailgun, lança-granadas e lança-foguetes.
- **7 tipos de inimigos:** soldado, cão infernal, cavaleiro, enforcer, ogro, Shambler e o chefe Chthon, cada um com IA, ataque e voz próprios.
- **Itens:** kits de saúde, armaduras (verde, amarela e vermelha), munição, chaves, *Dano Quádruplo*, *Pentagrama da Proteção* e vida extra.
- **3 vidas** por jogo e **4 dificuldades:** Fácil, Normal, Difícil e Pesadelo.
- **HUD** no estilo do original, com o rosto do protagonista que reage ao dano.
- **Tela de estatísticas** entre as fases: monstros, segredos e tempo.

## Como foi feito

| Área | Técnica |
|---|---|
| Gráficos | Three.js; texturas procedurais tileáveis (ruído fractal) com relevo falso; iluminação de tochas e lava **pré-calculada nos vértices**, com oclusão por linha de visão; neblina densa; partículas aditivas |
| Cenário | Colunas torneadas (*lathe*), portas em arco com moldura extrudada, rodapés, cornijas e teto irregular |
| Monstros | Malhas facetadas montadas por código, com ossos aparentes, dentes e olhos brilhantes. Animação procedural por osso: andar, respirar, atacar, dor e morte |
| Armas | Peças torneadas, madeira texturizada e metal com reflexo (mapa de ambiente gerado por código) |
| Movimento | Física estilo Quake: atrito, aceleração no ar, *strafe jump* e *rocket jump* |
| IA | Visão por linha de visão, audição de tiros, navegação por campo de fluxo (BFS) e ataques à distância e corpo a corpo |
| Áudio | **WebAudio 100% sintetizado**: tiros e explosões em camadas com saturação, reverb de caverna, vozes dos monstros por síntese de formantes, drone ambiente sombrio com sons ocasionais e batida industrial que entra no combate |

## Estrutura

```
index.html        página, estilos e HUD
js/util.js        RNG, ruído periódico e funções auxiliares
js/textures.js    texturas procedurais e temas das fases
js/audio.js       motor de áudio, reverb e trilha ambiente
js/audio2.js      vozes dos monstros e efeitos de tiros em camadas
js/level.js       gerador de fases, geometria e iluminação
js/fx.js          partículas, luzes dinâmicas e raios
js/entities.js    monstros (IA), projéteis e itens
js/models.js      modelos 3D dos monstros
js/gunmodels.js   modelos 3D das armas
js/weapons.js     disparo, troca e animação das armas
js/game.js        loop principal, jogador, HUD, menus e fases
viewer.html       visualizador de monstros para depuração
```

O `viewer.html` mostra um monstro em pose fixa. Exemplo: `viewer.html?m=dog&p=walk&a=1.0`. Os tipos são `grunt`, `dog`, `knight`, `enforcer`, `ogre`, `shambler` e `chthon`. As poses são `idle`, `walk`, `wind`, `melee` e `pain`.

## Limitações conhecidas

- Os mapas são gerados em grade e **não** reproduzem as fases originais do Quake. Os modelos são procedurais, bem mais simples que os do jogo de 1996.
- A colisão dos pilares é quadrada, embora o visual seja cilíndrico.
- Os sons são sintetizados e podem precisar de ajuste fino de gosto e volume.
- Testado principalmente no navegador do Claude Code (Chromium). Outros navegadores e placas de vídeo podem ter diferenças de desempenho.

## Licença

Este projeto é distribuído sob a **GNU Affero General Public License v3.0 (AGPL-3.0)**. Veja o arquivo [LICENSE](LICENSE).

Em resumo: você pode usar, estudar, modificar e redistribuir o código, desde que as versões modificadas mantenham a mesma licença e que o código-fonte seja disponibilizado, **inclusive para quem acessar o jogo pela rede** (por exemplo, se você hospedar uma versão modificada num site).

O Three.js, carregado via CDN, é distribuído sob a licença MIT e não faz parte deste repositório.
