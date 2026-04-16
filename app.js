const { useEffect, useState } = React;
const h = React.createElement;

// Detectar si estamos en desarrollo o producción
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocalhost 
  ? `${window.location.origin}/api`
  : 'https://us-central1-glamour-perfumes.cloudfunctions.net/api';

const produtosIniciais = [];

const PIX_CONFIG = {
  chave: '4504477c-1cb8-4789-9900-4e42f06d7a5c',
  nome: 'Jose Livan Hernandez Carvajal',
  cidade: 'Itupeva',
  descricao: 'Pagamento de pedido Perfume Glamour'
};

const formatarPreco = (valor) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const salvarLocalStorage = (chave, valor) => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (error) {
    console.warn('Nao foi possivel salvar no localStorage:', error);
  }
};

const carregarLocalStorage = (chave, padrao) => {
  try {
    const valor = localStorage.getItem(chave);
    return valor ? JSON.parse(valor) : padrao;
  } catch (error) {
    console.warn('Nao foi possivel carregar do localStorage:', error);
    return padrao;
  }
};

const sincronizarProdutosServidor = async (produtos) => {
  try {
    await fetchJson(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(produtos)
    });
  } catch (error) {
    console.warn('Falha ao sincronizar produtos com o servidor:', error.message || error);
  }
};

const emvTag = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

const calcularCrc16 = (str) => {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i += 1) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

const gerarPixPayload = (valor) => {
  const amount = Number(valor).toFixed(2);
  const merchantInfo =
    emvTag('00', 'br.gov.bcb.pix') +
    emvTag('01', PIX_CONFIG.chave) +
    emvTag('02', PIX_CONFIG.descricao);

  const payload =
    emvTag('00', '01') +
    emvTag('26', merchantInfo) +
    emvTag('52', '0000') +
    emvTag('53', '986') +
    emvTag('54', amount) +
    emvTag('58', 'BR') +
    emvTag('59', PIX_CONFIG.nome) +
    emvTag('60', PIX_CONFIG.cidade) +
    emvTag('62', emvTag('05', '***')) +
    '6304';

  return payload + calcularCrc16(payload);
};

const gerarPixQrUrl = (valor) => `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(gerarPixPayload(valor))}`;

const parseImagensLinhas = (texto) =>
  String(texto || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

const linhaParaUrlImagem = (linha) => {
  const t = String(linha || '').trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('/')) return t;
  return `/img/${encodeURIComponent(t)}`;
};

const normalizarImagensDoFormulario = (linhas) => linhas.map(linhaParaUrlImagem).filter(Boolean);

const imagemCatalogoParaLinhaFormulario = (url) => {
  const s = String(url || '');
  if (s.startsWith('/img/')) {
    const rest = s.slice(5);
    try {
      return decodeURIComponent(rest);
    } catch {
      return rest;
    }
  }
  return s;
};

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(text || 'Resposta invalida do servidor.');
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Erro na requisicao.');
  }

  return data;
};

function App() {
  const [abaAtiva, setAbaAtiva] = useState('produtos');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos');
  const [produtosLista, setProdutosLista] = useState(() => carregarLocalStorage('perfume_produtos', produtosIniciais));
  const [carrinho, setCarrinho] = useState(carregarLocalStorage('perfume_carrinho', []));
  const [pedidos, setPedidos] = useState(carregarLocalStorage('perfume_pedidos', []));
  const [indicesImagens, setIndicesImagens] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [mostrarCheckout, setMostrarCheckout] = useState(false);
  const [mostrarAdminLogin, setMostrarAdminLogin] = useState(false);
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
  const [processandoAdminLogin, setProcessandoAdminLogin] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState('pix');
  const [parcelas, setParcelas] = useState(1);
  const [etapaCheckout, setEtapaCheckout] = useState('resumo');
  const [erroCheckout, setErroCheckout] = useState('');
  const [cepError, setCepError] = useState('');
  const [adminAutenticado, setAdminAutenticado] = useState(sessionStorage.getItem('perfume_admin_auth') === 'true');
  const [adminErro, setAdminErro] = useState('');
  const [adminAssets, setAdminAssets] = useState([]);
  const [dadosCompra, setDadosCompra] = useState({
    nome: '',
    email: '',
    telefone: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    notificationType: 'email'
  });
  const [visualizacaoImagem, setVisualizacaoImagem] = useState(null);
  const [produtoPreview, setProdutoPreview] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);

  const abrirVisualizacaoImagem = (imagens, index, nome) => {
    if (!Array.isArray(imagens) || !imagens.length) return;
    const novoIndex = Math.max(0, Math.min(index, imagens.length - 1));
    setVisualizacaoImagem({ imagens, index: novoIndex, nome });
  };

  const fecharVisualizacaoImagem = () => {
    setVisualizacaoImagem(null);
  };

  const navegarImagemPreview = (delta) => {
    setVisualizacaoImagem((atual) => {
      if (!atual || !Array.isArray(atual.imagens) || atual.imagens.length === 0) return atual;
      const nextIndex = (atual.index + delta + atual.imagens.length) % atual.imagens.length;
      return { ...atual, index: nextIndex };
    });
  };

  const abrirProdutoPreview = (produto) => {
    setProdutoPreview({ ...produto, indiceImagem: 0 });
  };

  const fecharProdutoPreview = () => {
    setProdutoPreview(null);
  };

  const navegarProdutoPreview = (delta) => {
    setProdutoPreview((atual) => {
      if (!atual || !Array.isArray(atual.imagens) || atual.imagens.length === 0) return atual;
      const nextIndex = (atual.indiceImagem + delta + atual.imagens.length) % atual.imagens.length;
      return { ...atual, indiceImagem: nextIndex };
    });
  };

  const [novoProduto, setNovoProduto] = useState({
    nome: '',
    categoria: '',
    preco: '',
    descricao: '',
    imagens: []
  });
  const [produtoEmEdicaoId, setProdutoEmEdicaoId] = useState(null);
  const [credenciaisAdmin, setCredenciaisAdmin] = useState({
    username: '',
    password: ''
  });

  const carregandoInicial = React.useRef(true);
  const totalCarrinho = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

  useEffect(() => {
    if (carregandoInicial.current) return;
    salvarLocalStorage('perfume_produtos', produtosLista);
    sincronizarProdutosServidor(produtosLista);
  }, [produtosLista]);

  useEffect(() => {
    const localProducts = carregarLocalStorage('perfume_produtos', produtosIniciais);
    if (localProducts && localProducts.length > 0) {
      setProdutosLista(localProducts);
    }

    fetchJson(`${API_BASE}/products`)
      .then((products) => {
        if (Array.isArray(products) && products.length > 0) {
          setProdutosLista(products);
        }
      })
      .catch(() => {
        if (!localProducts || !localProducts.length) {
          setProdutosLista(produtosIniciais);
        }
      })
      .finally(() => {
        carregandoInicial.current = false;
      });
  }, []);

  useEffect(() => {
    salvarLocalStorage('perfume_carrinho', carrinho);
  }, [carrinho]);

  useEffect(() => {
    salvarLocalStorage('perfume_pedidos', pedidos);
  }, [pedidos]);

  useEffect(() => {
    if (!dadosCompra.telefone && dadosCompra.notificationType !== 'email') {
      setDadosCompra((atual) => ({ ...atual, notificationType: 'email' }));
    }
  }, [dadosCompra.telefone, dadosCompra.notificationType]);

  useEffect(() => {
    if (!adminAutenticado) return;

    const carregarAssetsAdmin = async () => {
      try {
        const data = await fetchJson(`${API_BASE}/admin/assets`);
        setAdminAssets(data.files || []);
      } catch (error) {
        setMensagem(error.message || 'Nao foi possivel listar os arquivos locais.');
        limparMensagem();
      }
    };

    carregarAssetsAdmin();
  }, [adminAutenticado]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');
    const orderId = params.get('order_id');

    if (payment === 'success' && sessionId && orderId) {
      atualizarStatusPedido(sessionId, orderId);
    }

    if (payment === 'cancel') {
      setMensagem('Pagamento cancelado. Voce pode tentar novamente ou escolher outro metodo.');
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const pendentes = pedidos.filter((pedido) =>
        pedido.id && pedido.status && pedido.status.toLowerCase().includes('aguardando')
      );

      for (const pedido of pendentes) {
        try {
          const atualizado = await fetchJson(`${API_BASE}/order-status?order_id=${encodeURIComponent(pedido.id)}`);
          if (atualizado.status !== pedido.status) {
            setPedidos((atuais) => atuais.map((item) => item.id === atualizado.id ? { ...item, ...atualizado } : item));
            setMensagem('Pedido atualizado com o estado mais recente.');
          }
        } catch (error) {
          // ignora falhas de polling
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [pedidos]);

  const limparMensagem = () => window.setTimeout(() => setMensagem(''), 3200);

  const atualizarCampo = (campo, valor) => {
    setDadosCompra((atual) => ({ ...atual, [campo]: valor }));
  };

  const atualizarNovoProduto = (campo, valor) => {
    setNovoProduto((atual) => ({ ...atual, [campo]: valor }));
  };

  const alternarArquivoLocalNoFormulario = (arquivo) => {
    setNovoProduto((atual) => {
      const lista = Array.isArray(atual.imagens) ? [...atual.imagens] : parseImagensLinhas(String(atual.imagens));
      const idx = lista.indexOf(arquivo);
      if (idx >= 0) {
        lista.splice(idx, 1);
      } else {
        lista.push(arquivo);
      }
      return { ...atual, imagens: lista };
    });
  };

  const resetFormularioProduto = () => {
    setNovoProduto({
      nome: '',
      categoria: '',
      preco: '',
      descricao: '',
      imagens: []
    });
    setProdutoEmEdicaoId(null);
  };

  const atualizarCredencialAdmin = (campo, valor) => {
    setCredenciaisAdmin((atual) => ({ ...atual, [campo]: valor }));
  };

  const adicionarAoCarrinho = (produto) => {
    setCarrinho((atual) => {
      const existente = atual.find((item) => item.id === produto.id);
      if (existente) {
        return atual.map((item) => item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item);
      }
      return [...atual, { ...produto, imagem: produto.imagens[0], quantidade: 1 }];
    });
    setMensagem(`${produto.nome} adicionado ao carrinho.`);
    limparMensagem();
  };

  const alterarQuantidade = (produtoId, delta) => {
    setCarrinho((atual) => atual.map((item) =>
      item.id === produtoId ? { ...item, quantidade: Math.max(1, item.quantidade + delta) } : item
    ));
  };

  const removerDoCarrinho = (produtoId) => {
    setCarrinho((atual) => atual.filter((item) => item.id !== produtoId));
  };

  const adicionarProdutoAoCatalogo = () => {
    const nome = novoProduto.nome.trim();
    const categoria = novoProduto.categoria.trim() || 'Colecao';
    const descricao = novoProduto.descricao.trim();
    const preco = Number(String(novoProduto.preco).replace(',', '.'));
    const linhas = Array.isArray(novoProduto.imagens) ? novoProduto.imagens : parseImagensLinhas(novoProduto.imagens);
    const imagens = normalizarImagensDoFormulario(linhas);

    if (!nome || !descricao || !imagens.length || Number.isNaN(preco) || preco <= 0) {
      setMensagem('Preencha nome, descricao, preco e ao menos uma imagem (URL https ou nome de arquivo na pasta img/).');
      limparMensagem();
      return;
    }

    const idBase = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `perfume-${Date.now()}`;

    const id = produtosLista.some((item) => item.id === idBase) ? `${idBase}-${Date.now()}` : idBase;

    const produto = {
      id,
      nome,
      categoria,
      descricao,
      preco,
      imagens
    };

    const novoCatalogo = [produto, ...produtosLista];
    setProdutosLista(novoCatalogo);
    sincronizarProdutosServidor(novoCatalogo);
    resetFormularioProduto();
    setMensagem('Produto adicionado ao catalogo.');
    limparMensagem();
  };

  const iniciarEdicaoProduto = (produto) => {
    setProdutoEmEdicaoId(produto.id);
    setNovoProduto({
      nome: produto.nome,
      categoria: produto.categoria,
      preco: String(produto.preco),
      descricao: produto.descricao,
      imagens: (produto.imagens || []).map(imagemCatalogoParaLinhaFormulario)
    });
    setShowAdminPanel(false); // Cerrar el panel de administración al editar
    setAbaAtiva('produtos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const salvarEdicaoProduto = () => {
    if (!produtoEmEdicaoId) {
      adicionarProdutoAoCatalogo();
      return;
    }

    const nome = novoProduto.nome.trim();
    const categoria = novoProduto.categoria.trim() || 'Colecao';
    const descricao = novoProduto.descricao.trim();
    const preco = Number(String(novoProduto.preco).replace(',', '.'));
    const linhas = Array.isArray(novoProduto.imagens) ? novoProduto.imagens : parseImagensLinhas(novoProduto.imagens);
    const imagens = normalizarImagensDoFormulario(linhas);

    if (!nome || !descricao || !imagens.length || Number.isNaN(preco) || preco <= 0) {
      setMensagem('Preencha nome, descricao, preco e ao menos uma imagem (URL https ou nome de arquivo na pasta img/).');
      limparMensagem();
      return;
    }

    const catalogoAtualizado = produtosLista.map((produto) =>
      produto.id === produtoEmEdicaoId
        ? { ...produto, nome, categoria, descricao, preco, imagens }
        : produto
    );
    setProdutosLista(catalogoAtualizado);
    sincronizarProdutosServidor(catalogoAtualizado);
    setCarrinho((atual) => atual.map((item) =>
      item.id === produtoEmEdicaoId
        ? { ...item, nome, categoria, descricao, preco, imagens, imagem: imagens[0] }
        : item
    ));
    resetFormularioProduto();
    setMensagem('Produto atualizado.');
    limparMensagem();
  };

  const eliminarProdutoDoCatalogo = (produtoId) => {
    const catalogoAtualizado = produtosLista.filter((item) => item.id !== produtoId);
    setProdutosLista(catalogoAtualizado);
    sincronizarProdutosServidor(catalogoAtualizado);
    setCarrinho((atual) => atual.filter((item) => item.id !== produtoId));
    setIndicesImagens((atual) => {
      const copia = { ...atual };
      delete copia[produtoId];
      return copia;
    });
    if (produtoEmEdicaoId === produtoId) {
      resetFormularioProduto();
    }
    setMensagem('Produto removido do site.');
    limparMensagem();
  };

  const restaurarCatalogoBase = () => {
    setProdutosLista(produtosIniciais);
    sincronizarProdutosServidor(produtosIniciais);
    resetFormularioProduto();
    setMensagem('Catalogo restaurado para a configuracao base.');
    limparMensagem();
  };

  const abrirAdmin = () => {
    if (adminAutenticado) {
      setAbaAtiva('produtos');
      return;
    }
    setAdminErro('');
    setMostrarAdminLogin(true);
  };

  const fecharAdminLogin = () => {
    setMostrarAdminLogin(false);
    setAdminErro('');
    setCredenciaisAdmin({ username: '', password: '' });
  };

  const autenticarAdmin = async () => {
    if (!credenciaisAdmin.username.trim() || !credenciaisAdmin.password.trim()) {
      setAdminErro('Informe usuario e senha.');
      return;
    }

    setProcessandoAdminLogin(true);
    setAdminErro('');

    try {
      await fetchJson(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credenciaisAdmin.username.trim(),
          password: credenciaisAdmin.password
        })
      });

      sessionStorage.setItem('perfume_admin_auth', 'true');
      setAdminAutenticado(true);
      setAbaAtiva('produtos');
      fecharAdminLogin();
    } catch (error) {
      setAdminErro(error.message || 'Nao foi possivel autenticar.');
    } finally {
      setProcessandoAdminLogin(false);
    }
  };

  const sairDoAdmin = () => {
    sessionStorage.removeItem('perfume_admin_auth');
    setAdminAutenticado(false);
    setAbaAtiva('produtos');
  };

  const buscarEnderecoPorCep = async (cepValue) => {
    const cep = String(cepValue || '').replace(/\D/g, '');
    if (cep.length !== 8) {
      setCepError('Digite um CEP valido com 8 digitos.');
      return;
    }

    setCepError('Buscando endereco...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        throw new Error('CEP nao encontrado.');
      }

      setDadosCompra((atual) => ({
        ...atual,
        cep,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
        complemento: data.complemento || atual.complemento
      }));
      setCepError('');
    } catch (error) {
      setCepError(error.message || 'Nao foi possivel buscar o CEP.');
    }
  };

  const validarCheckout = () => {
    const nome = dadosCompra.nome.trim();
    const email = dadosCompra.email.trim();
    const cep = dadosCompra.cep.replace(/\D/g, '');

    if (!nome || nome.split(' ').length < 2) return 'Informe nome e sobrenome.';
    if (!validarEmail(email)) return 'Informe um e-mail valido.';
    if (!cep || cep.length !== 8 || !dadosCompra.logradouro.trim() || !dadosCompra.numero.trim() || !dadosCompra.bairro.trim() || !dadosCompra.cidade.trim() || !dadosCompra.estado.trim()) {
      return 'Complete o endereco com CEP, rua, numero, bairro, cidade e estado.';
    }
    if (!carrinho.length) return 'Seu carrinho esta vazio.';
    return '';
  };

  const construirCliente = () => ({
    nome: dadosCompra.nome.trim(),
    email: dadosCompra.email.trim(),
    telefone: dadosCompra.telefone.trim(),
    notificationType: dadosCompra.telefone.trim() ? dadosCompra.notificationType : 'email',
    endereco: {
      cep: dadosCompra.cep.replace(/\D/g, ''),
      logradouro: dadosCompra.logradouro.trim(),
      numero: dadosCompra.numero.trim(),
      complemento: dadosCompra.complemento.trim(),
      bairro: dadosCompra.bairro.trim(),
      cidade: dadosCompra.cidade.trim(),
      estado: dadosCompra.estado.trim()
    }
  });

  const itensPedido = () => carrinho.map((item) => ({
    id: item.id,
    nome: item.nome,
    quantidade: item.quantidade,
    preco: item.preco
  }));

  const resetCheckout = () => {
    setCarrinho([]);
    setMostrarCheckout(false);
    setEtapaCheckout('resumo');
    setDadosCompra({
      nome: '',
      email: '',
      telefone: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      notificationType: 'email'
    });
    setCepError('');
    setErroCheckout('');
  };

  const finalizarCompra = async () => {
    const erro = validarCheckout();
    if (erro) {
      setErroCheckout(erro);
      return;
    }

    setErroCheckout('');
    setProcessandoPagamento(true);

    const cliente = construirCliente();
    const itens = itensPedido();

    try {
      if (metodoPagamento === 'pix') {
        const qrCode = gerarPixQrUrl(totalCarrinho);
        const registro = await fetchJson(`${API_BASE}/register-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cliente,
            itens,
            total: totalCarrinho,
            metodoPagamento: 'pix',
            parcelas: 1,
            chavePix: PIX_CONFIG.chave,
            qrCode
          })
        });

        const novoPedido = {
          id: registro.orderId,
          cliente,
          itens,
          total: totalCarrinho,
          status: 'Aguardando Pagamento Pix',
          data: new Date().toLocaleString('pt-BR'),
          metodoPagamento: 'pix',
          parcelas: 1,
          chavePix: PIX_CONFIG.chave,
          qrCode
        };

        setPedidos((atual) => [novoPedido, ...atual]);
        resetCheckout();
        setMensagem('Pedido criado. Use o QR Code ou a chave Pix para pagar.');
        limparMensagem();
        return;
      }

      const stripe = await fetchJson(`${API_BASE}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: cliente.email,
          installments: parcelas,
          items: carrinho.map((item) => ({
            title: item.nome,
            unit_price: Number(item.preco),
            quantity: Number(item.quantidade),
            picture_url: item.imagem,
            currency_id: 'BRL'
          })),
          order: {
            cliente,
            itens,
            total: totalCarrinho,
            parcelas
          }
        })
      });

      const novoPedido = {
        id: stripe.orderId || `PED-${Date.now()}`,
        cliente,
        itens,
        total: totalCarrinho,
        status: 'Aguardando Pagamento',
        data: new Date().toLocaleString('pt-BR'),
        metodoPagamento: 'stripe',
        parcelas,
        stripeSessionId: stripe.sessionId,
        paymentUrl: stripe.url
      };

      setPedidos((atual) => [novoPedido, ...atual]);
      resetCheckout();
      setMensagem('Pedido criado. Redirecionando para o checkout Stripe.');
      limparMensagem();
      window.setTimeout(() => {
        window.location.href = stripe.url;
      }, 900);
    } catch (error) {
      setErroCheckout(error.message || 'Nao foi possivel finalizar o pedido.');
    } finally {
      setProcessandoPagamento(false);
    }
  };

  const confirmarPixPedido = async (orderId) => {
    try {
      const data = await fetchJson(`${API_BASE}/confirm-pix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId })
      });
      setPedidos((atual) => atual.map((pedido) => pedido.id === orderId ? { ...pedido, ...data } : pedido));
      setMensagem('Pagamento Pix confirmado.');
      limparMensagem();
    } catch (error) {
      setMensagem(error.message || 'Nao foi possivel confirmar o Pix.');
      limparMensagem();
    }
  };

  const atualizarStatusPedido = async (sessionId, orderId) => {
    try {
      const data = await fetchJson(`${API_BASE}/confirm-stripe-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, order_id: orderId })
      });

      setPedidos((atual) => {
        const existe = atual.some((pedido) => pedido.id === data.id);
        if (!existe) return [data, ...atual];
        return atual.map((pedido) => pedido.id === data.id ? { ...pedido, ...data } : pedido);
      });

      setMensagem('Pagamento confirmado.');
      limparMensagem();
    } catch (error) {
      setMensagem(error.message || 'Nao foi possivel verificar o pagamento Stripe.');
      limparMensagem();
    }
  };

  const cancelarPedido = async (pedidoId) => {
    try {
      const data = await fetchJson(`${API_BASE}/orders/${pedidoId}/cancel`, { method: 'POST' });
      setPedidos((atual) => atual.map((pedido) => pedido.id === pedidoId ? data.order : pedido));
      setMensagem('Pedido cancelado.');
      limparMensagem();
    } catch (error) {
      setMensagem(error.message || 'Nao foi possivel cancelar o pedido.');
      limparMensagem();
    }
  };

  const completarPedido = async (pedidoId) => {
    try {
      const data = await fetchJson(`${API_BASE}/orders/${pedidoId}/complete`, { method: 'POST' });
      setPedidos((atual) => atual.map((pedido) => pedido.id === pedidoId ? data.order : pedido));
      setMensagem('Pedido marcado como completado.');
      limparMensagem();
    } catch (error) {
      setMensagem(error.message || 'Nao foi possivel completar o pedido.');
      limparMensagem();
    }
  };

  const reenviarConfirmacao = async (pedidoId) => {
    try {
      await fetchJson(`${API_BASE}/orders/${pedidoId}/resend-confirmation`, { method: 'POST' });
      setMensagem('Confirmacao reenviada.');
      limparMensagem();
    } catch (error) {
      setMensagem(error.message || 'Nao foi possivel reenviar a confirmacao.');
      limparMensagem();
    }
  };

  const eliminarPedido = async (pedidoId) => {
    try {
      await fetchJson(`${API_BASE}/orders/${pedidoId}`, { method: 'DELETE' });
      setPedidos((atual) => atual.filter((pedido) => pedido.id !== pedidoId));
      setMensagem('Pedido eliminado.');
      limparMensagem();
    } catch (error) {
      setMensagem(error.message || 'Nao foi possivel eliminar o pedido.');
      limparMensagem();
    }
  };

  const verEtiqueta = (orderId) => {
    window.open(`/order-label?order_id=${encodeURIComponent(orderId)}`, '_blank');
  };

  const renderProdutos = () => {
    const categorias = ['Todos', ...new Set(produtosLista.map(p => p.categoria))];
    const produtosFiltrados = categoriaFiltro === 'Todos' 
      ? produtosLista 
      : produtosLista.filter(p => p.categoria === categoriaFiltro);

    return h(React.Fragment, null,
    h('section', { className: 'page-hero' },
      h('div', { className: 'hero-copy' },
        h('span', { className: 'hero-kicker' }, 'Curadoria olfativa'),
        h('h2', null, 'Perfumes com presenca de boutique.'),
        h('p', null, 'Uma selecao enxuta, visual editorial e checkout direto para transformar a loja em algo mais premium e menos generico.'),
        h('div', { className: 'hero-actions' },
          h('button', { className: 'btn-primary', onClick: () => setAbaAtiva('carrinho') }, `Ver carrinho (${carrinho.length})`),
          h('button', { className: 'btn-secondary', onClick: () => window.scrollTo({ top: 720, behavior: 'smooth' }) }, 'Explorar colecao'),
          adminAutenticado && h('button', { className: 'btn-secondary', onClick: () => setShowAdminPanel(!showAdminPanel) }, 'Gerir loja')
        )
      )
    ),
    h('section', null,
      h('div', { className: 'section-heading' },
        h('div', null,
          h('span', { className: 'section-kicker' }, 'Colecao selecionada'),
          h('h3', null, 'Fragrancias para noite, assinatura e presente')
        ),
      ),
      h('div', { className: 'filtros-categoria' },
        categorias.map(cat => h('button', {
          key: cat,
          className: `filter-btn ${categoriaFiltro === cat ? 'active' : ''}`,
          onClick: () => setCategoriaFiltro(cat)
        }, cat))
      ),
      produtosFiltrados.length === 0 ?
        h('div', { className: 'produtos-vazio' },
          h('h3', null, 'Nenhum produto disponivel'),
          h('p', null, 'A galeria esta vazia. Clique em restaurar para carregar os itens iniciais ou adicione novos produtos na area restrita.'),
          adminAutenticado ? null : h('button', { className: 'btn-secondary', onClick: restaurarCatalogoBase }, 'Restaurar vitrine base')
        ) :
        h('div', { className: 'produtos-grid' },
          produtosFiltrados.map((produto) => {
            const indiceAtual = indicesImagens[produto.id] || 0;
            const proximo = (indiceAtual + 1) % produto.imagens.length;
            const anterior = (indiceAtual - 1 + produto.imagens.length) % produto.imagens.length;

            return h('article', { key: produto.id, className: 'produto-card', onClick: () => abrirProdutoPreview(produto) },
              h('div', { className: 'carrossel-container' },
              h('button', {
                className: 'carrossel-btn carrossel-btn-prev',
                title: 'Imagem anterior',
                onClick: (e) => {
                  e.stopPropagation();
                  setIndicesImagens((atual) => ({ ...atual, [produto.id]: anterior }));
                }
              }, '<'),
              h('div', { className: 'carrossel-image-wrapper' },
                h('img', {
                  className: 'carrossel-image',
                  src: produto.imagens[indiceAtual],
                  alt: `${produto.nome} - imagem ${indiceAtual + 1}`,
                  onClick: (e) => {
                    e.stopPropagation();
                    abrirVisualizacaoImagem(produto.imagens, indiceAtual, produto.nome);
                  }
                })
              ),
              h('button', {
                className: 'carrossel-btn carrossel-btn-next',
                title: 'Imagem seguinte',
                onClick: (e) => {
                  e.stopPropagation();
                  setIndicesImagens((atual) => ({ ...atual, [produto.id]: proximo }));
                }
              }, '>')
            ),
            h('div', { className: 'carrossel-indicadores' },
              produto.imagens.map((_, index) =>
                h('button', {
                  key: `${produto.id}-${index}`,
                  className: `indicador ${index === indiceAtual ? 'ativo' : ''}`,
                  title: `Ir para imagem ${index + 1}`,
                  onClick: (e) => {
                    e.stopPropagation();
                    setIndicesImagens((atual) => ({ ...atual, [produto.id]: index }));
                  }
                })
              )
            ),
            h('div', { className: 'producto-info' },
              h('span', { className: 'categoria' }, produto.categoria),
              h('h3', null, produto.nome),
              h('p', null, produto.descricao),
              h('div', { className: 'preco-area' },
                h('span', { className: 'preco-de' }, 'A partir de:'),
                h('div', { className: 'preco' }, formatarPreco(produto.preco))
              ),
              h('div', { className: 'parcela' }, `ou 6x de ${formatarPreco(produto.preco / 6)} Sem juros`),
              h('button', { className: 'btn-adicionar', onClick: (e) => {
                e.stopPropagation();
                adicionarAoCarrinho(produto);
              } }, 'ESCOLHER')
            )
          );
        })
      )
    )
    );
  };

  const renderPreviewImagem = () => {
    if (!visualizacaoImagem) return null;

    return h('div', {
      className: 'image-preview-overlay',
      onClick: fecharVisualizacaoImagem
    },
      h('div', {
        className: 'image-preview-modal',
        onClick: (event) => event.stopPropagation()
      },
        h('button', {
          className: 'image-preview-close',
          onClick: fecharVisualizacaoImagem,
          type: 'button'
        }, 'x'),
        h('button', {
          className: 'image-preview-nav image-preview-prev',
          type: 'button',
          onClick: () => navegarImagemPreview(-1)
        }, '<'),
        h('div', { className: 'image-preview-content' },
          h('img', {
            className: 'image-preview-img',
            src: visualizacaoImagem.imagens[visualizacaoImagem.index],
            alt: `${visualizacaoImagem.nome} - imagem ${visualizacaoImagem.index + 1}`
          }),
          h('p', { className: 'image-preview-caption' }, `${visualizacaoImagem.nome} • ${visualizacaoImagem.index + 1} / ${visualizacaoImagem.imagens.length}`)
        ),
        h('button', {
          className: 'image-preview-nav image-preview-next',
          type: 'button',
          onClick: () => navegarImagemPreview(1)
        }, '>')
      )
    );
  };

  const renderProdutoPreview = () => {
    if (!produtoPreview) return null;

    const imagens = produtoPreview.imagens || [];
    const imagemAtual = imagens[produtoPreview.indiceImagem] || '';

    return h('div', {
      className: 'produto-preview-overlay',
      onClick: fecharProdutoPreview
    },
      h('div', {
        className: 'produto-preview-modal',
        onClick: (event) => event.stopPropagation()
      },
        h('button', {
          className: 'produto-preview-close',
          onClick: fecharProdutoPreview,
          type: 'button'
        }, 'x'),
        h('div', { className: 'produto-preview-container' },
          h('div', { className: 'produto-preview-imagens' },
            h('div', { className: 'produto-preview-carrossel' },
              imagens.length > 1 ? h('button', {
                className: 'preview-nav preview-prev',
                onClick: () => navegarProdutoPreview(-1),
                type: 'button'
              }, '<') : null,
              h('img', {
                className: 'preview-imagem-principal',
                src: imagemAtual,
                alt: produtoPreview.nome
              }),
              imagens.length > 1 ? h('button', {
                className: 'preview-nav preview-next',
                onClick: () => navegarProdutoPreview(1),
                type: 'button'
              }, '>') : null
            ),
            imagens.length > 1 ? h('p', { className: 'imagem-contador' }, `${produtoPreview.indiceImagem + 1} / ${imagens.length}`) : null
          ),
          h('div', { className: 'produto-preview-info' },
            h('h2', null, produtoPreview.nome),
            h('p', { className: 'categoria-tag' }, produtoPreview.categoria || 'Perfume'),
            h('p', { className: 'descricao-completa' }, produtoPreview.descricao || 'Fragrância exclusiva'),
            h('div', { className: 'preco-bloque' },
              h('span', { className: 'preco-desde' }, `A partir de: ${formatarPreco(produtoPreview.preco)}`),
              h('span', { className: 'preco-parcelas' }, `ou 6x de ${formatarPreco(produtoPreview.preco / 6)} Sem juros`)
            ),
            h('button', {
              className: 'btn-primary preview-add-cart',
              onClick: () => {
                adicionarAoCarrinho(produtoPreview);
                fecharProdutoPreview();
              }
            }, 'ESCOLHER')
          )
        )
      )
    );
  };

  const renderFormProdutoModal = () => {
    return h('div', {
      className: 'form-modal-overlay'
    },
      h('div', {
        className: 'form-modal-content',
        onClick: (e) => e.stopPropagation()
      },
        h('div', { className: 'form-modal-header' },
          h('h3', null, produtoEmEdicaoId ? 'Editar Produto' : 'Novo Produto'),
          h('button', {
            className: 'form-modal-close',
            onClick: () => {
              setShowFormModal(false);
              if (!produtoEmEdicaoId) resetFormularioProduto();
              if (produtoEmEdicaoId) setShowAdminPanel(true); // Reabrir panel si estaba editando
            }
          }, '×')
        ),
        h('div', { className: 'form-modal-body' },
          h('div', { className: 'form-row' },
            h('div', { className: 'form-group' },
              h('label', null, '📦 Nome do Produto *'),
              h('input', {
                value: novoProduto.nome,
                onChange: (e) => atualizarNovoProduto('nome', e.target.value),
                placeholder: 'Ex.: Amber Reserve',
                maxLength: 100
              })
            ),
            h('div', { className: 'form-group' },
              h('label', null, '🏷️ Categoria *'),
              h('input', {
                value: novoProduto.categoria,
                onChange: (e) => atualizarNovoProduto('categoria', e.target.value),
                placeholder: 'Feminino, Masculino, Unissex...',
                maxLength: 50
              })
            )
          ),
          h('div', { className: 'form-row' },
            h('div', { className: 'form-group' },
              h('label', null, '💰 Preço (R$) *'),
              h('input', {
                type: 'number',
                value: novoProduto.preco,
                onChange: (e) => atualizarNovoProduto('preco', e.target.value),
                placeholder: '249.90',
                step: '0.01',
                min: '0'
              })
            )
          ),
          h('div', { className: 'form-group' },
            h('label', null, '📝 Descrição *'),
            h('textarea', {
              value: novoProduto.descricao,
              onChange: (e) => atualizarNovoProduto('descricao', e.target.value),
              placeholder: 'Notas olfativas, mood e ocasiões de uso...',
              maxLength: 500,
              rows: 4
            })
          ),
          h('div', { className: 'form-group' },
            h('label', null, '🖼️ Imagens *'),
            h('p', { className: 'form-hint' }, 'Uma URL (https://) ou nome de arquivo por linha'),
            h('textarea', {
              value: (Array.isArray(novoProduto.imagens) ? novoProduto.imagens : []).join('\\n'),
              onChange: (e) => atualizarNovoProduto('imagens', parseImagensLinhas(e.target.value)),
              placeholder: 'https://example.com/img.jpg\\nautra-url.jpg\\nfoto-local.png',
              rows: 6
            })
          ),
          adminAssets.length ? h('div', { className: 'form-group' },
            h('label', null, '📂 Arquivos locais (img/)'),
            h('div', { className: 'admin-asset-chips' },
              adminAssets.map((file) => {
                const selecionado = (Array.isArray(novoProduto.imagens) ? novoProduto.imagens : []).includes(file);
                return h('button', {
                  type: 'button',
                  key: file,
                  className: `admin-asset-chip${selecionado ? ' admin-asset-chip--on' : ''}`,
                  onClick: () => alternarArquivoLocalNoFormulario(file)
                }, file);
              })
            )
          ) : null
        ),
        h('div', { className: 'form-modal-footer' },
          h('button', {
            className: 'btn-secondary',
            onClick: () => {
              setShowFormModal(false);
              if (!produtoEmEdicaoId) resetFormularioProduto();
              if (produtoEmEdicaoId) setShowAdminPanel(true); // Reabrir panel si estaba editando
            }
          }, 'Cancelar'),
          h('button', {
            className: 'btn-primary',
            onClick: () => {
              if (produtoEmEdicaoId) {
                salvarEdicaoProduto();
              } else {
                adicionarProdutoAoCatalogo();
              }
              setShowFormModal(false);
              if (produtoEmEdicaoId) setShowAdminPanel(true); // Reabrir panel después de guardar edición
            }
          }, produtoEmEdicaoId ? 'Salvar Mudanças' : 'Criar Produto')
        )
      )
    );
  };

  const renderAdminPanelNovo = () => {
    return h('div', {
      className: 'admin-panel-overlay',
      onClick: () => setShowAdminPanel(false)
    },
      h('div', {
        className: 'admin-panel-content',
        onClick: (e) => e.stopPropagation()
      },
        h('div', { className: 'admin-panel-header' },
          h('div', null,
            h('h2', null, '⚙️ Painel de Administração'),
            h('p', null, 'Gerencie sua coleção de produtos de forma fácil e rápida')
          ),
          h('button', {
            className: 'admin-panel-close',
            onClick: () => setShowAdminPanel(false)
          }, '×')
        ),
        h('div', { className: 'admin-panel-body' },
          h('div', { className: 'admin-stats' },
            h('div', { className: 'admin-stat-card'},
              h('span', { className: 'stat-value' }, produtosLista.length),
              h('span', { className: 'stat-label' }, '-- Produtos')
            ),
            h('div', { className: 'admin-stat-card' },
              h('span', { className: 'stat-value' }, formatarPreco(produtosLista.reduce((sum, p) => sum + p.preco, 0))),
              h('span', { className: 'stat-label' }, ' --  Valor total')
            )
          ),
          h('div', { className: 'admin-actions' },
            h('button', {
              className: 'btn-primary admin-btn-large',
              onClick: () => {
                resetFormularioProduto();
                setShowFormModal(true);
              }
            }, '➕ Novo Produto'),
            h('button', {
              className: 'btn-secondary admin-btn-large',
              onClick: restaurarCatalogoBase
            }, '🔄 Restaurar Catálogo Base')
          ),
          h('div', { className: 'admin-products-section' },
            h('h3', null, '📦 Seus Produtos'),
            produtosLista.length === 0
              ? h('div', { className: 'admin-empty-state' },
                  h('p', null, 'Nenhum produto ainda.'),
                  h('button', {
                    className: 'btn-primary',
                    onClick: () => setShowFormModal(true)
                  }, 'Criar primeiro produto')
                )
              : h('div', { className: 'admin-products-grid' },
                  produtosLista.map((produto) =>
                    h('div', { key: `admin-${produto.id}`, className: 'admin-product-card' },
                      h('div', { className: 'admin-product-image' },
                        h('img', {
                          src: produto.imagens[0],
                          alt: produto.nome,
                          onError: (e) => e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22400%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22300%22 height=%22400%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22%3EImagem não encontrada%3C/text%3E%3C/svg%3E'
                        })
                      ),
                      h('div', { className: 'admin-product-info' },
                        h('h4', null, produto.nome),
                        h('p', { className: 'admin-product-category' }, `${produto.categoria} • ${formatarPreco(produto.preco)}`),
                        h('p', { className: 'admin-product-desc' }, produto.descricao.substring(0, 80) + '...'),
                        h('div', { className: 'admin-product-actions' },
                          h('button', {
                            className: 'btn-secondary btn-small',
                            onClick: () => {
                              iniciarEdicaoProduto(produto);
                              setShowFormModal(true);
                            }
                          }, '✏️ Editar'),
                          h('button', {
                            className: 'btn-secondary btn-small btn-danger',
                            onClick: () => {
                              if (confirm(`Deseja realmente eliminar "${produto.nome}"?`)) {
                                eliminarProdutoDoCatalogo(produto.id);
                              }
                            }
                          }, '🗑️ Deletar')
                        )
                      )
                    )
                  )
                )
          )
        )
      )
    );
  };

  const renderCarrinho = () => {
    if (!carrinho.length) {
      return h('section', { className: 'carrinho-vazio' },
        h('h3', null, 'Seu carrinho esta vazio'),
        h('p', null, 'Adicione uma fragrancia para comecar o checkout.'),
        h('button', { className: 'btn-primary', onClick: () => setAbaAtiva('produtos') }, 'Ver produtos')
      );
    }

    return h('section', { className: 'carrinho-content' },
      h('div', { className: 'carrinho-itens' },
        carrinho.map((item) =>
          h('div', { key: item.id, className: 'carrinho-item' },
            h('div', { className: 'item-info' },
              h('h4', null, item.nome),
              h('p', null, `${formatarPreco(item.preco)} x ${item.quantidade}`)
            ),
            h('div', { className: 'item-controls' },
              h('button', { onClick: () => alterarQuantidade(item.id, -1) }, '-'),
              h('span', null, item.quantidade),
              h('button', { onClick: () => alterarQuantidade(item.id, 1) }, '+'),
              h('button', { className: 'btn-remover', onClick: () => removerDoCarrinho(item.id) }, 'x')
            ),
            h('div', { className: 'item-total' }, formatarPreco(item.preco * item.quantidade))
          )
        )
      ),
      h('aside', { className: 'carrinho-resumo' },
        h('span', { className: 'section-kicker' }, 'Resumo'),
        h('h3', null, 'Checkout pronto'),
        h('p', null, 'Frete e notificacoes sao confirmados nas etapas seguintes.'),
        h('div', { className: 'resumo-total' }, h('strong', null, `Total: ${formatarPreco(totalCarrinho)}`)),
        h('button', {
          className: 'btn-checkout',
          onClick: () => {
            setMostrarCheckout(true);
            setEtapaCheckout('resumo');
          }
        }, 'Finalizar compra')
      )
    );
  };

  const renderResumoPedido = () => h(React.Fragment, null,
    h('div', { className: 'checkout-resumo' },
      h('h3', null, 'Resumo do pedido'),
      h('div', { className: 'resumo-itens' },
        carrinho.map((item) =>
          h('div', { key: item.id, className: 'resumo-item' },
            h('div', { className: 'item-detalhes' },
              h('span', { className: 'item-nome' }, item.nome),
              h('span', { className: 'item-quantidade' }, `x${item.quantidade}`)
            ),
            h('span', { className: 'item-preco' }, formatarPreco(item.preco * item.quantidade))
          )
        )
      ),
      h('div', { className: 'resumo-total' }, `Total: ${formatarPreco(totalCarrinho)}`)
    ),
    h('div', { className: 'checkout-footer' },
      h('button', { className: 'btn-secondary', onClick: () => setMostrarCheckout(false) }, 'Voltar ao carrinho'),
      h('button', { className: 'btn-primary', onClick: () => setEtapaCheckout('dados') }, 'Continuar')
    )
  );

  const renderDadosEntrega = () => h(React.Fragment, null,
    h('div', { className: 'checkout-form' },
      h('div', { className: 'form-group' },
        h('label', null, 'Nome completo'),
        h('input', { value: dadosCompra.nome, onChange: (e) => atualizarCampo('nome', e.target.value), placeholder: 'Seu nome completo' })
      ),
      h('div', { className: 'form-group' },
        h('label', null, 'E-mail'),
        h('input', { type: 'email', value: dadosCompra.email, onChange: (e) => atualizarCampo('email', e.target.value), placeholder: 'seu@email.com' })
      ),
      h('div', { className: 'form-group' },
        h('label', null, 'Telefone'),
        h('input', { type: 'tel', value: dadosCompra.telefone, onChange: (e) => atualizarCampo('telefone', e.target.value), placeholder: '(11) 99999-9999' }),
        h('small', null, 'Opcional. Se preencher, voce pode receber SMS.')
      ),
      h('div', { className: 'form-group' },
        h('label', null, 'Como deseja receber notificacoes?'),
        h('div', { className: 'notification-options' },
          ['email', 'sms', 'both'].map((tipo) =>
            h('label', { key: tipo, className: 'notification-option' },
              h('input', {
                type: 'radio',
                name: 'notificationType',
                value: tipo,
                checked: dadosCompra.notificationType === tipo,
                disabled: tipo !== 'email' && !dadosCompra.telefone.trim(),
                onChange: (e) => atualizarCampo('notificationType', e.target.value)
              }),
              h('span', null, tipo === 'email' ? 'Apenas Email' : tipo === 'sms' ? 'Apenas SMS' : 'Email + SMS')
            )
          )
        )
      ),
      h('div', { className: 'form-row' },
        h('div', { className: 'form-group' },
          h('label', null, 'CEP'),
          h('input', {
            value: dadosCompra.cep,
            onChange: (e) => atualizarCampo('cep', e.target.value),
            onBlur: (e) => buscarEnderecoPorCep(e.target.value),
            placeholder: '00000-000',
            maxLength: 9
          }),
          cepError ? h('small', null, cepError) : null
        ),
        h('div', { className: 'form-group' },
          h('label', null, 'Numero'),
          h('input', { value: dadosCompra.numero, onChange: (e) => atualizarCampo('numero', e.target.value), placeholder: '123' })
        )
      ),
      h('div', { className: 'form-row' },
        h('div', { className: 'form-group' },
          h('label', null, 'Rua'),
          h('input', { value: dadosCompra.logradouro, onChange: (e) => atualizarCampo('logradouro', e.target.value), placeholder: 'Rua, avenida, travessa' })
        ),
        h('div', { className: 'form-group' },
          h('label', null, 'Complemento'),
          h('input', { value: dadosCompra.complemento, onChange: (e) => atualizarCampo('complemento', e.target.value), placeholder: 'Apto, bloco, casa' })
        )
      ),
      h('div', { className: 'form-row' },
        h('div', { className: 'form-group' },
          h('label', null, 'Bairro'),
          h('input', { value: dadosCompra.bairro, onChange: (e) => atualizarCampo('bairro', e.target.value), placeholder: 'Bairro' })
        ),
        h('div', { className: 'form-group' },
          h('label', null, 'Cidade / Estado'),
          h('div', { className: 'form-row' },
            h('input', { value: dadosCompra.cidade, onChange: (e) => atualizarCampo('cidade', e.target.value), placeholder: 'Cidade' }),
            h('input', { value: dadosCompra.estado, onChange: (e) => atualizarCampo('estado', e.target.value), placeholder: 'UF', maxLength: 2 })
          )
        )
      )
    ),
    erroCheckout ? h('div', { className: 'mensagem erro' }, erroCheckout) : null,
    h('div', { className: 'checkout-footer' },
      h('button', { className: 'btn-secondary', onClick: () => setEtapaCheckout('resumo') }, 'Voltar'),
      h('button', {
        className: 'btn-primary',
        onClick: () => {
          const erro = validarCheckout();
          if (erro) {
            setErroCheckout(erro);
            return;
          }
          setErroCheckout('');
          setEtapaCheckout('pagamento');
        }
      }, 'Ir para pagamento')
    )
  );

  const renderMetodoPagamento = () => h(React.Fragment, null,
    h('div', { className: 'pix-section' },
      h('h3', null, 'Metodo de pagamento'),
      h('div', { className: 'pix-option' },
        h('label', null,
          h('input', {
            type: 'radio',
            name: 'metodoPagamento',
            value: 'pix',
            checked: metodoPagamento === 'pix',
            onChange: (e) => setMetodoPagamento(e.target.value)
          }),
          h('span', null, 'Pagamento via Pix')
        ),
        metodoPagamento === 'pix' ? h('div', { className: 'pix-details' },
          h('p', null, 'Escaneie o QR Code ou copie a chave para concluir o pagamento.'),
          h('div', { className: 'pix-qr' }, h('img', { className: 'qr-image', src: gerarPixQrUrl(totalCarrinho), alt: 'QR Code Pix' })),
          h('div', { className: 'pix-copy' },
            h('input', { readOnly: true, value: PIX_CONFIG.chave, className: 'codigo-pix-texto' }),
            h('button', { className: 'btn-copiar', onClick: () => navigator.clipboard.writeText(PIX_CONFIG.chave) }, 'Copiar')
          )
        ) : null
      ),
      h('div', { className: 'pix-option' },
        h('label', null,
          h('input', {
            type: 'radio',
            name: 'metodoPagamento',
            value: 'stripe',
            checked: metodoPagamento === 'stripe',
            onChange: (e) => setMetodoPagamento(e.target.value)
          }),
          h('span', null, 'Stripe: cartao, boleto e carteiras digitais')
        ),
        metodoPagamento === 'stripe' ? h('div', { className: 'installments-section' },
          h('h4', null, 'Pagamento via Stripe'),
          h('p', null, 'Voce sera redirecionado para a plataforma Stripe para concluir o pedido.'),
          totalCarrinho > 100
            ? [1, 2, 3, 4, 5, 6].map((num) =>
                h('label', { key: num, className: 'installments-option' },
                  h('input', {
                    type: 'radio',
                    name: 'parcelas',
                    value: num,
                    checked: parcelas === num,
                    onChange: (e) => setParcelas(Number(e.target.value))
                  }),
                  h('div', { className: 'installments-details' },
                    h('h5', null, `${num}x de ${formatarPreco(totalCarrinho / num)}`),
                    num > 1 ? h('p', null, `Total: ${formatarPreco(totalCarrinho)}`) : h('p', null, 'Pagamento a vista')
                  )
                )
              )
            : h('p', null, 'O pagamento sera processado em 1x.')
        ) : null
      )
    ),
    erroCheckout ? h('div', { className: 'mensagem erro' }, erroCheckout) : null,
    h('div', { className: 'checkout-resumo' },
      h('h3', null, 'Resumo final'),
      h('div', { className: 'resumo-itens' },
        carrinho.map((item) => h('div', { key: item.id, className: 'resumo-item' }, `${item.nome} x${item.quantidade} - ${formatarPreco(item.preco * item.quantidade)}`))
      ),
      h('div', { className: 'resumo-total' }, `Total: ${formatarPreco(totalCarrinho)}`)
    ),
    h('div', { className: 'checkout-footer' },
      h('button', { className: 'btn-secondary', onClick: () => setEtapaCheckout('dados') }, 'Voltar'),
      h('button', { className: 'btn-primary', onClick: finalizarCompra, disabled: processandoPagamento }, processandoPagamento ? 'Processando...' : 'Confirmar compra')
    )
  );

  const renderCheckout = () => {
    const titulo = etapaCheckout === 'resumo' ? 'Resumo do pedido' : etapaCheckout === 'dados' ? 'Dados de entrega' : 'Pagamento';

    return h('div', { className: 'checkout-overlay' },
      h('div', { className: 'checkout-modal' },
        h('div', { className: 'checkout-header' },
          h('h2', null, titulo),
          h('button', {
            className: 'btn-close',
            onClick: () => {
              setMostrarCheckout(false);
              setEtapaCheckout('resumo');
              setErroCheckout('');
              setCepError('');
            }
          }, 'x')
        ),
        h('div', { className: 'checkout-body' },
          etapaCheckout === 'resumo' ? renderResumoPedido() : etapaCheckout === 'dados' ? renderDadosEntrega() : renderMetodoPagamento()
        )
      )
    );
  };

  const renderAdminLogin = () => h('div', { className: 'checkout-overlay' },
    h('div', { className: 'checkout-modal admin-modal' },
      h('div', { className: 'checkout-header' },
        h('h2', null, 'Acesso restrito'),
        h('button', { className: 'btn-close', onClick: fecharAdminLogin }, 'x')
      ),
      h('div', { className: 'checkout-body' },
        h('div', { className: 'checkout-form admin-login-form' },
          h('div', { className: 'form-group' },
            h('label', null, 'Usuario'),
            h('input', {
              value: credenciaisAdmin.username,
              onChange: (e) => atualizarCredencialAdmin('username', e.target.value),
              placeholder: 'Seu usuario'
            })
          ),
          h('div', { className: 'form-group' },
            h('label', null, 'Senha'),
            h('input', {
              type: 'password',
              value: credenciaisAdmin.password,
              onChange: (e) => atualizarCredencialAdmin('password', e.target.value),
              placeholder: 'Sua senha'
            })
          ),
          adminErro ? h('div', { className: 'mensagem erro' }, adminErro) : null,
          h('div', { className: 'checkout-footer' },
            h('button', { className: 'btn-secondary', onClick: fecharAdminLogin }, 'Cancelar'),
            h('button', { className: 'btn-primary', onClick: autenticarAdmin, disabled: processandoAdminLogin }, processandoAdminLogin ? 'Entrando...' : 'Entrar')
          )
        )
      )
    )
  );

  const renderPedidos = () => {
    if (!pedidos.length) {
      return h('section', { className: 'pedidos-vazio' },
        h('h3', null, 'Nenhum pedido ainda'),
        h('p', null, 'Finalize uma compra para acompanhar o status aqui.'),
        h('button', { className: 'btn-primary', onClick: () => setAbaAtiva('produtos') }, 'Ver produtos')
      );
    }

    return h('section', { className: 'pedidos-lista' },
      pedidos.map((pedido) =>
        h('article', { key: pedido.id, className: 'pedido-card' },
          h('div', { className: 'pedido-header' },
            h('h3', null, `Pedido ${pedido.id}`),
            h('span', { className: `status ${String(pedido.status || '').toLowerCase().replace(/ /g, '-')}` }, pedido.status)
          ),
          h('div', { className: 'pedido-info' },
            h('p', null, `Cliente: ${pedido.cliente?.nome || '-'}`),
            h('p', null, `Email: ${pedido.cliente?.email || '-'}`),
            h('p', null, `Data: ${pedido.data || '-'}`),
            h('p', null, `Pagamento: ${pedido.metodoPagamento === 'pix' ? 'Pix' : `Stripe (${pedido.parcelas || 1}x)`}`)
          ),
          h('div', { className: 'pedido-itens' },
            (pedido.itens || []).map((item) => h('div', { key: `${pedido.id}-${item.id}`, className: 'pedido-item' }, `${item.nome} x${item.quantidade} - ${formatarPreco(item.preco * item.quantidade)}`))
          ),
          pedido.metodoPagamento === 'pix'
            ? h('div', { className: 'qr-code' },
                h('h4', null, 'Pagamento via Pix'),
                h('div', { className: 'qr-container' }, h('img', { className: 'qr-image', src: pedido.qrCode, alt: 'QR Code Pix' })),
                h('div', { className: 'codigo-pix' },
                  h('small', null, 'Chave Pix'),
                  h('div', { className: 'codigo-pix-texto' }, pedido.chavePix),
                  h('button', { className: 'btn-copiar', onClick: () => navigator.clipboard.writeText(pedido.chavePix) }, 'Copiar chave')
                )
              )
            : null,
          h('div', { className: 'pedido-total' }, `Total: ${formatarPreco(pedido.total)}`),
          h('div', { className: 'pedido-actions' },
            pedido.status?.toLowerCase().includes('aguardando') && pedido.paymentUrl ? h('a', { className: 'btn-primary', href: pedido.paymentUrl, target: '_blank', rel: 'noreferrer' }, 'Retomar Stripe') : null,
            pedido.status?.toLowerCase().includes('aguardando') && pedido.stripeSessionId ? h('button', { className: 'btn-secondary', onClick: () => atualizarStatusPedido(pedido.stripeSessionId, pedido.id) }, 'Verificar pagamento') : null,
            pedido.status?.toLowerCase().includes('aguardando') && pedido.metodoPagamento === 'pix' ? h('button', { className: 'btn-primary', onClick: () => confirmarPixPedido(pedido.id) }, 'Confirmar Pix') : null,
            pedido.status?.toLowerCase().includes('pago') ? h('button', { className: 'btn-secondary', onClick: () => verEtiqueta(pedido.id) }, 'Ver etiqueta A6') : null
          ),
          h('div', { className: 'pedido-actions' },
            !pedido.status?.toLowerCase().includes('cancelado') && !pedido.status?.toLowerCase().includes('pago') && !pedido.status?.toLowerCase().includes('completado') ? h('button', { className: 'btn-secondary', onClick: () => cancelarPedido(pedido.id) }, 'Cancelar pedido') : null,
            pedido.status?.toLowerCase().includes('pago') && !pedido.status?.toLowerCase().includes('completado') ? h('button', { className: 'btn-secondary', onClick: () => completarPedido(pedido.id) }, 'Marcar completado') : null,
            pedido.status?.toLowerCase().includes('pago') ? h('button', { className: 'btn-secondary', onClick: () => reenviarConfirmacao(pedido.id) }, 'Reenviar confirmacao') : null,
            h('button', { className: 'btn-secondary', onClick: () => eliminarPedido(pedido.id) }, 'Eliminar pedido')
          )
        )
      )
    );
  };

  return h('div', { className: `app ${mostrarCheckout ? 'checkout-open' : ''}` },
    h('header', { className: 'header' },
      h('div', { className: 'brand' },
        h('div', { className: 'brand-mark' }, 
          h('img', { src: '/img/PG Logo/logo 9.png', alt: 'Perfume Glamour Logo', className: 'brand-logo' })
        ),
        h('div', { className: 'brand-title' },
          h('h1', null, 'Glamour Perfumes'),
          h('p', null, 'Perfumes exclusivos com entrega rapida')
        )
      ),
      h('nav', { className: 'nav' },
        h('button', { className: `nav-btn ${abaAtiva === 'produtos' ? 'active' : ''}`, onClick: () => setAbaAtiva('produtos') }, 'Produtos'),
        h('button', { className: `nav-btn ${abaAtiva === 'carrinho' ? 'active' : ''}`, onClick: () => setAbaAtiva('carrinho') }, `Carrinho (${carrinho.length})`),
        h('button', { className: `nav-btn ${abaAtiva === 'pedidos' ? 'active' : ''}`, onClick: () => setAbaAtiva('pedidos') }, 'Meus pedidos'),
        adminAutenticado ? h('button', { className: `nav-btn ${abaAtiva === 'produtos' ? 'active' : ''}`, onClick: () => setAbaAtiva('produtos') }, 'Modo admin') : null
      )
    ),
    mensagem ? h('div', { className: `mensagem ${String(mensagem).toLowerCase().includes('nao') || String(mensagem).toLowerCase().includes('erro') ? 'erro' : 'sucesso'}` }, mensagem) : null,
    h('main', { className: 'main' },
      abaAtiva === 'produtos' ? renderProdutos() : null,
      abaAtiva === 'carrinho' ? renderCarrinho() : null,
      abaAtiva === 'pedidos' ? renderPedidos() : null
    ),
    mostrarCheckout ? renderCheckout() : null,
    renderPreviewImagem(),
    renderProdutoPreview(),
    showAdminPanel && adminAutenticado ? renderAdminPanelNovo() : null,
    showFormModal && adminAutenticado ? renderFormProdutoModal() : null,
    mostrarAdminLogin ? renderAdminLogin() : null,
    h('footer', { className: 'footer' },
      h('div', { className: 'footer-actions' },
        h('p', null, `(c) ${new Date().getFullYear()} Perfume Glamour - vitrine premium com checkout direto`),
        adminAutenticado
          ? h('button', { className: 'btn-secondary footer-admin-btn', onClick: sairDoAdmin }, 'Sair do admin')
          : h('button', { className: 'btn-secondary footer-admin-btn', onClick: abrirAdmin }, 'Acesso restrito')
      )
    )
  );
}

try {
  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
} catch (error) {
  console.error('Erro ao renderizar React:', error);
  document.getElementById('root').innerHTML = `
    <div style="padding:48px;text-align:center;color:#8d342b;">
      <h2>Erro ao carregar a aplicacao React</h2>
      <p>Verifique o console do navegador para mais detalhes.</p>
    </div>
  `;
}
