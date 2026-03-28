const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const params = new URLSearchParams(window.location.search);
const coreName = params.get('core') || 'Central'; // URLに ?core= があればそれを使う

// ステータス表示の更新
document.getElementById('core-status').innerHTML = `
  <span style="color:#238636">●</span> Core: <span style="color:#58a6ff">${coreName}</span>
`;

const container = document.getElementById('chat-container');
const input = document.getElementById('chat-input');
const nameInput = document.getElementById('user-name');
nameInput.value = localStorage.getItem('core_user') || 'Guest';

function append(data) {
  const isMe = data.sender_name === nameInput.value;
  const wrapper = document.createElement('div');
  wrapper.className = 'msg-wrapper';
  wrapper.style.alignItems = isMe ? 'flex-end' : 'flex-start';

  wrapper.innerHTML = `
    ${!isMe ? `<span class="sender">${data.sender_name}</span>` : ''}
    <div class="msg-bubble ${isMe ? 'my-msg' : 'other-msg'}">${data.content}</div>
  `;
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
}

// 送信処理
async function send() {
  const content = input.value.trim();
  const sender = nameInput.value.trim() || 'Guest';
  if (!content) return;

  localStorage.setItem('core_user', sender);
  await supabaseClient.from('core_messages').insert([{ core_name: coreName, sender_name: sender, content }]);
  input.value = '';
}

// 過去ログ取得
async function init() {
  const { data } = await supabaseClient.from('core_messages').select('*').eq('core_name', coreName).order('created_at', { ascending: true });
  if (data) data.forEach(append);
}

// リアルタイム監視
supabaseClient.channel(`room:${coreName}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'core_messages', filter: `core_name=eq.${coreName}` }, 
  payload => append(payload.new))
  .subscribe();

document.getElementById('send-btn').onclick = send;
input.onkeypress = (e) => { if(e.key==='Enter') send(); };
init();