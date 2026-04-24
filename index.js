const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== CONFIG =====
const cargoAdmin = "943302582816890973";
const cargoFila = "943302704275550208";
const cargoPago = "1489100736225870015";

const canalPagamento = "1489094389698527334";

// ===== MEMÓRIA =====
let fila = [];
let filaReserva = [];
let painel = null;

// ===== SALVAR =====
function salvar() {
  fs.writeFile('dados.json',
    JSON.stringify({ fila, filaReserva }, null, 2),
    () => {}
  );
}

// ===== READY =====
client.on('clientReady', () => console.log('⚡ BOT DIARIO ONLINE'));

// ===== COMANDOS =====
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (!msg.member.roles.cache.has(cargoAdmin)) return;

  // ===== PAINEL =====
  if (msg.content === '!painel') {
    msg.delete().catch(()=>{});

    const embed = new EmbedBuilder()
      .setTitle("💰 Sala | R$5")
      .setDescription("Ninguém na fila.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('entrar').setLabel('Entrar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('sair').setLabel('Sair').setStyle(ButtonStyle.Danger)
    );

    painel = await msg.channel.send({ embeds:[embed], components:[row] });
  }

  // ===== FINALIZAR =====
  if (msg.content === '!finalizar') {
    msg.delete().catch(()=>{});

    try {
      for (const userId of [...fila, ...filaReserva]) {
        const membro = await msg.guild.members.fetch(userId).catch(()=>null);
        if (membro) await membro.roles.remove(cargoFila).catch(()=>{});
      }

      fila = [];
      filaReserva = [];
      salvar();

      if (painel) {
        await painel.delete().catch(()=>{});
        painel = null;
      }

      msg.channel.send(
        "🏁 Partida finalizada!\n\n" +
        "⚡ Quem não conseguiu entrar fica ligado, pois novas partidas serão anunciadas em breve.\n" +
        "🎮 Continue acompanhando o JJ Diários para não perder as próximas!"
      );

    } catch (err) {
      console.log(err);
    }
  }
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (i) => {
  if (!i.isButton()) return;

  try {
    await i.reply({ content: '✔️', ephemeral: true });

    // ===== ENTRAR =====
    if (i.customId === 'entrar') {

      if (fila.includes(i.user.id) || filaReserva.includes(i.user.id)) {
        return i.followUp({ content: 'Você já está na fila.', ephemeral: true });
      }

      if (fila.length < 10) {
        fila.push(i.user.id);
        await i.member.roles.add(cargoFila).catch(()=>{});
      } else if (filaReserva.length < 10) {
        filaReserva.push(i.user.id);
      } else {
        return i.followUp({ content: '🚫 Todas as filas estão cheias!', ephemeral: true });
      }

      salvar();

      atualizarPainel();

      // SALA CHEIA
      if (fila.length === 10) iniciarCiclo(i);

    }

    // ===== SAIR =====
    if (i.customId === 'sair') {

      if (fila.includes(i.user.id)) {
        fila = fila.filter(id => id !== i.user.id);
        await i.member.roles.remove(cargoFila).catch(()=>{});
      } else if (filaReserva.includes(i.user.id)) {
        filaReserva = filaReserva.filter(id => id !== i.user.id);
      }

      salvar();
      atualizarPainel();
    }

  } catch (err) {
    console.log("ERRO:", err);
  }
});

// ===== ATUALIZAR PAINEL =====
async function atualizarPainel() {
  if (!painel) return;

  const lista = fila.length ? fila.map(id=>`<@${id}>`).join('\n') : "Ninguém na fila.";
  const reserva = filaReserva.length ? filaReserva.map(id=>`<@${id}>`).join('\n') : "Ninguém na reserva.";

  await painel.edit({
    embeds:[new EmbedBuilder()
      .setTitle("💰 Sala | R$5")
      .setDescription(`🎮 **Fila:**\n${lista}\n\n🕒 **Reserva:**\n${reserva}`)]
  }).catch(()=>{});
}

// ===== CICLO DE PAGAMENTO =====
async function iniciarCiclo(i) {

  await i.channel.send(
    "🔥 Sala fechada!\n\n" +
    `🎟️ Vá até o canal <#${canalPagamento}> e envie o comprovante.\n\n` +
    "⏱️ Tempo: 10 minutos"
  );

  setTimeout(async () => {
    try {

      let removidos = [];
      let adicionados = [];

      // VERIFICAR PAGAMENTO (CORRIGIDO)
      for (const userId of [...fila]) {

        const membro = await i.guild.members.fetch(userId, { force: true }).catch(()=>null);
        if (!membro) continue;

        if (!membro.roles.cache.has(cargoPago)) {
          await membro.roles.remove(cargoFila).catch(()=>{});
          fila = fila.filter(id => id !== userId);
          removidos.push(`<@${userId}>`);
        }
      }

      // PUXAR RESERVA
      while (fila.length < 10 && filaReserva.length > 0) {

        const novo = filaReserva.shift();
        fila.push(novo);

        const membro = await i.guild.members.fetch(novo).catch(()=>null);
        if (membro) await membro.roles.add(cargoFila).catch(()=>{});

        adicionados.push(`<@${novo}>`);
      }

      salvar();
      atualizarPainel();

      await i.channel.send(
        `⏱️ Tempo encerrado!\n\n` +
        `❌ Removidos:\n${removidos.join('\n') || 'Ninguém'}\n\n` +
        `✅ Entraram da reserva:\n${adicionados.join('\n') || 'Ninguém'}`
      );

      // CICLO CONTÍNUO
      if (fila.length === 10) {
        iniciarCiclo(i);
      }

    } catch (err) {
      console.log("Erro timer:", err);
    }
  }, 10 * 60 * 1000);
}

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

client.login(process.env.TOKEN);