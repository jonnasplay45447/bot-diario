require('dotenv').config();

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
let reserva = [];
let painel = null;
let timer = null;

// ===== SALVAR =====
function salvar() {
  fs.writeFileSync('dados.json', JSON.stringify({ fila, reserva }, null, 2));
}

// ===== EMBED =====
function gerarEmbed() {
  const lista = fila.length ? fila.map(id=>`<@${id}>`).join('\n') : "Ninguém na fila.";
  const listaReserva = reserva.length ? reserva.map(id=>`<@${id}>`).join('\n') : "Ninguém na reserva.";

  return new EmbedBuilder()
    .setTitle("💰 Sala | R$5")
    .setDescription(`🎮 **Fila:**\n${lista}\n\n🕒 **Reserva:**\n${listaReserva}`);
}

// ===== READY =====
client.once('clientReady', () => {
  console.log('BOT DIARIO ONLINE');
});

// ===== COMANDOS =====
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (!msg.member.roles.cache.has(cargoAdmin)) return;

  if (msg.content === '!painel') {
    msg.delete().catch(()=>{});

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('entrar').setLabel('Entrar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('sair').setLabel('Sair').setStyle(ButtonStyle.Danger)
    );

    painel = await msg.channel.send({
      embeds: [gerarEmbed()],
      components: [row]
    });
  }

  if (msg.content === '!finalizar') {
    msg.delete().catch(()=>{});

    for (const id of [...fila, ...reserva]) {
      const membro = await msg.guild.members.fetch(id).catch(()=>null);
      if (membro) await membro.roles.remove(cargoFila).catch(()=>{});
    }

    fila = [];
    reserva = [];
    salvar();

    if (painel) {
      await painel.delete().catch(()=>{});
      painel = null;
    }

    msg.channel.send(
      "🏁 Partida finalizada!\n\n" +
      "⚡ Quem não conseguiu entrar fica ligado.\n" +
      "🎮 Novas partidas em breve!"
    );
  }
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (i) => {
  if (!i.isButton()) return;

  try {
    await i.reply({ content: '✔️', ephemeral: true });

    // ===== ENTRAR =====
    if (i.customId === 'entrar') {

      if (fila.includes(i.user.id) || reserva.includes(i.user.id)) {
        return i.followUp({ content: 'Você já está na fila.', ephemeral: true });
      }

      if (fila.length < 10) {
        fila.push(i.user.id);
        await i.member.roles.add(cargoFila).catch(()=>{});
      } else if (reserva.length < 10) {
        reserva.push(i.user.id);
      } else {
        return i.followUp({ content: 'Filas cheias.', ephemeral: true });
      }

      salvar();

      if (painel) await painel.edit({ embeds: [gerarEmbed()] });

      // SALA LOTOU
      if (fila.length === 10 && !timer) {

        await i.channel.send(
          `🔥 Sala fechada!\n\n🎟️ Vá até <#${canalPagamento}> enviar comprovante.\n⏱️ 10 minutos`
        );

        timer = setInterval(async () => {
          try {

            let removidos = [];
            let adicionados = [];

            for (const id of [...fila]) {
              const membro = await i.guild.members.fetch(id).catch(()=>null);
              if (!membro || !membro.roles.cache.has(cargoPago)) {
                if (membro) await membro.roles.remove(cargoFila).catch(()=>{});
                fila = fila.filter(x => x !== id);
                removidos.push(`<@${id}>`);
              }
            }

            while (fila.length < 10 && reserva.length > 0) {
              const novo = reserva.shift();
              fila.push(novo);

              const membro = await i.guild.members.fetch(novo).catch(()=>null);
              if (membro) await membro.roles.add(cargoFila).catch(()=>{});

              adicionados.push(`<@${novo}>`);
            }

            salvar();
            if (painel) await painel.edit({ embeds: [gerarEmbed()] });

            await i.channel.send(
              `⏱️ Atualização:\n\n❌ Removidos:\n${removidos.join('\n') || 'Ninguém'}\n\n✅ Entraram:\n${adicionados.join('\n') || 'Ninguém'}`
            );

            if (fila.length < 10) {
              clearInterval(timer);
              timer = null;
            }

          } catch {}
        }, 10 * 60 * 1000);
      }
    }

    // ===== SAIR =====
    if (i.customId === 'sair') {

      if (fila.includes(i.user.id)) {
        fila = fila.filter(id => id !== i.user.id);
        await i.member.roles.remove(cargoFila).catch(()=>{});
      } else if (reserva.includes(i.user.id)) {
        reserva = reserva.filter(id => id !== i.user.id);
      }

      salvar();
      if (painel) await painel.edit({ embeds: [gerarEmbed()] });
    }

  } catch (err) {
    console.log("ERRO:", err);
  }
});

client.login(process.env.TOKEN);