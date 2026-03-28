const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const userNameInput = document.getElementById('user-name');

// 自分の名前を保存しておく
let myName = localStorage.getItem('chat_name') || "ゲスト";
userNameInput.value = myName;

// --- メッセージを表示する関数 ---
function appendMessage(data) {
  const isMe = data.sender_name === userNameInput.value;
  const msgDiv = document.createElement('div');
  msgDiv.style.display = 'flex';
  msgDiv.style.flexDirection = 'column';
  msgDiv.style.alignItems = isMe ? 'flex-end' : 'flex-start';

  msgDiv.innerHTML = `
    ${!isMe ? `<span class="sender-name">${escapeHTML(data.sender_name)}</span>` : ''}
    <div class="msg ${isMe ? 'my-msg' : 'other-msg'}">
      ${escapeHTML(data.content)}
    </div>
  `;
  
  chatContainer.appendChild(msgDiv);
  // 一番下までスクロール (Discordっぽい挙動)
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// --- 過去ログ読み込み ---
async function loadMessages() {
  const { data } = await supabaseClient
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(50);
  
  chatContainer.innerHTML = '';
  if (data) data.forEach(msg => appendMessage(msg));
}

// --- メッセージ送信 ---
async function sendMessage() {
  const content = chatInput.value.trim();
  const name = userNameInput.value.trim() || "ゲスト";
  if (!content) return;

  localStorage.setItem('chat_name', name); // 名前を保存

  await supabaseClient.from('chat_messages').insert([{
    sender_name: name,
    content: content
  }]);

  chatInput.value = '';
}

// --- リアルタイム監視 (ここがキモ) ---
supabaseClient
  .channel('public:chat_messages')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
    appendMessage(payload.new);
  })
  .subscribe();

// イベント
sendBtn.onclick = sendMessage;
chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

loadMessages();

// --- 🏷️ URLから「Core名」を取得 ---
const params = new URLSearchParams(window.location.search);
// URLが chat.html?core=秘密会議 なら "秘密会議" を取得。なければ "Central"
const coreName = params.get('core') || 'Central';

// ヘッダーの表示を「Core」に書き換え
// Discord風に「Core: 秘密会議」と表示
document.querySelector('header div').innerHTML = `
  <span style="color: #5865f2; margin-right: 5px;">●</span> 
  Core: <span style="color: #fff; font-weight: bold;">${escapeHTML(coreName)}</span>
`;

// --- メッセージ送信時の処理 ---
async function sendMessage() {
  const content = chatInput.value.trim();
  const name = userNameInput.value.trim() || "Guest";
  if (!content) return;

  // room_name の代わりに core_name として保存（SQLのカラム名に合わせて調整してね）
  await supabaseClient.from('chat_messages').insert([{
    room_name: coreName, // ここがCoreの識別子
    sender_name: name,
    content: content
  }]);

  chatInput.value = '';
}

// --- リアルタイム監視もこのCore専用に ---
supabaseClient
  .channel(`core_${coreName}`)
  .on('postgres_changes', { 
    event: 'INSERT', 
    schema: 'public', 
    table: 'chat_messages',
    filter: `room_name=eq.${coreName}` 
  }, payload => {
    appendMessage(payload.new);
  })
  .subscribe();

  