// Perfume Glamour - Integração com Stripe
const { useState, useEffect } = React;
const API_BASE = 'http://localhost:5500/api';

// Dados dos produtos
const produtos = [
  {
    id: 'aurora',
    nome: 'Aurora Eau de Parfum',
    descricao: 'Notas florais e amadeiradas para uma presença marcante em todas as ocasiões.',
    preco: 10.00,
    imagem: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80',
    categoria: 'Feminino',
  },
  {
    id: 'noir',
    nome: 'Noir Elegance',
    descricao: 'Mistura sofisticada de bergamota, baunilha e patchouli para um charme misterioso.',
    preco: 279.90,
    imagem: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
    categoria: 'Masculino',
  },
  {
    id: 'amour',
    nome: 'Amour Rosa',
    descricao: 'Perfume delicado com toque frutado e romântico, ideal para momentos especiais.',
    preco: 219.90,
    imagem: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=800&q=80',
    categoria: 'Unissex',
  },
  {
    id: 'midnight',
    nome: 'Midnight Velvet',
    descricao: 'A sensualidade da noite traduzida em uma fragrância marcante e envolvente.',
    preco: 299.90,
    imagem: 'https://images.unsplash.com/photo-1517673132409-3f6a8e5a0088?auto=format&fit=crop&w=800&q=80',
    categoria: 'Masculino',
  },
];

// Funções utilitárias
const formatarPreco = (valor) => {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
};

const validarEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validarCPF = (cpf) => {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  let soma = 0;
  let resto;
  for (let i = 1; i <= 9; i++) {
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  return true;
};

const PIX_CONFIG = {
  chave: '4504477c-1cb8-4789-9900-4e42f06d7a5c',
  nome: 'Jose Livan Hernandez Carvajal',
  cidade: 'Itupeva',
  descricao: 'Pagamento de pedido Perfume Glamour',
  cep: '13296-108'
};

const emvTag = (id, value) => {
  const length = value.length.toString().padStart(2, '0');
  return `${id}${length}${value}`;
};

const calcularCrc16 = (str) => {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

const gerarPixPayload = (valor, config) => {
  const amount = Number(valor).toFixed(2);
  const merchantAccountInformation =
    emvTag('00', 'br.gov.bcb.pix') +
    emvTag('01', config.chave) +
    emvTag('02', config.descricao);

  const payload =
    emvTag('00', '01') +
    emvTag('26', merchantAccountInformation) +
    emvTag('52', '0000') +
    emvTag('53', '986') +
    emvTag('54', amount) +
    emvTag('58', 'BR') +
    emvTag('59', config.nome) +
    emvTag('60', config.cidade) +
    emvTag('62', emvTag('05', '***')) +
    '6304';

  return payload + calcularCrc16(payload);
};

const gerarPixQrUrl = (valor, config) => {
  const payload = gerarPixPayload(valor, config);
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(payload)}`;
};

const buscarPedidoServidor = async (orderId) => {
  const response = await fetch(`${API_BASE}/order-status?order_id=${encodeURIComponent(orderId)}`);
  if (!response.ok) {
    throw new Error('No se pudo obtener el estado del pedido.');
  }
  return response.json();
};

const buscarPedidoPorSession = async (sessionId) => {
  const response = await fetch(`${API_BASE}/order-by-session?session_id=${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    throw new Error('No se pudo obtener el pedido para la sesión Stripe.');
  }
  return response.json();
};

const verEtiqueta = (orderId) => {
  const url = `/order-label?order_id=${encodeURIComponent(orderId)}`;
  window.open(url, '_blank');
};

const salvarLocalStorage = (chave, valor) => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (e) {
    console.warn('Erro ao salvar no localStorage:', e);
  }
};

const carregarLocalStorage = (chave, padrao = []) => {
  try {
    const item = localStorage.getItem(chave);
    return item ? JSON.parse(item) : padrao;
  } catch (e) {
    console.warn('Erro ao carregar do localStorage:', e);
    return padrao;
  }
};

// Componente Principal
function App() {
  const [abaAtiva, setAbaAtiva] = useState('produtos');
  const [carrinho, setCarrinho] = useState(carregarLocalStorage('perfume_carrinho', []));
  const [pedidos, setPedidos] = useState(carregarLocalStorage('perfume_pedidos', []));
  const [mensagem, setMensagem] = useState('');
  const [mostrarCheckout, setMostrarCheckout] = useState(false);
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
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
    notificationType: 'email' // 'email', 'sms', 'both'
  });
  const [erroCheckout, setErroCheckout] = useState('');
  const [cepError, setCepError] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('pix'); // 'pix' or 'stripe'
  const [parcelas, setParcelas] = useState(1);
  const [etapaCheckout, setEtapaCheckout] = useState('resumo'); // 'resumo', 'dados', 'pagamento'

  const buscarEnderecoPorCep = async (cepValue) => {
    const cep = String(cepValue || '').replace(/\D/g, '');
    if (cep.length !== 8) {
      setCepError('CEP inválido. Digite 8 dígitos.');
      return;
    }

    setCepError('Buscando endereço...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        throw new Error('CEP não encontrado.');
      }

      setDadosCompra(prev => ({
        ...prev,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
        complemento: data.complemento || '',
        cep
      }));
      setCepError('');
    } catch (error) {
      setCepError(error.message || 'Não foi possível buscar o CEP.');
      setDadosCompra(prev => ({
        ...prev,
        logradouro: '',
        bairro: '',
        cidade: '',
        estado: '',
        complemento: ''
      }));
    }
  };

  // Salvar carrinho quando muda
  useEffect(() => {
    salvarLocalStorage('perfume_carrinho', carrinho);
  }, [carrinho]);

  // Salvar pedidos quando muda
  useEffect(() => {
    salvarLocalStorage('perfume_pedidos', pedidos);
  }, [pedidos]);

  // Poll automático para pedidos en estado pendiente
  useEffect(() => {
    const interval = setInterval(async () => {
      const pedidosPendentes = pedidos.filter(pedido =>
        pedido.id &&
        pedido.status &&
        pedido.status.toLowerCase().includes('aguardando')
      );

      if (pedidosPendentes.length === 0) {
        return;
      }

      for (const pedido of pedidosPendentes) {
        try {
          const serverOrder = await buscarPedidoServidor(pedido.id);
          if (serverOrder && serverOrder.status !== pedido.status) {
            setPedidos(current => current.map(item =>
              item.id === serverOrder.id ? { ...item, ...serverOrder } : item
            ));
            setMensagem('✅ El pedido se ha actualizado automáticamente con el estado más reciente.');
          }
        } catch (error) {
          // Ignorar si el pedido no está registrado en el servidor o si la consulta falla.
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [pedidos]);

  // Adicionar produto ao carrinho
  const adicionarAoCarrinho = (produto) => {
    setCarrinho(atual => {
      const existente = atual.find(item => item.id === produto.id);
      if (existente) {
        return atual.map(item =>
          item.id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      return [...atual, { ...produto, quantidade: 1 }];
    });
    setMensagem(`✅ ${produto.nome} adicionado ao carrinho!`);
    setTimeout(() => setMensagem(''), 3000);
  };

  // Remover produto do carrinho
  const removerDoCarrinho = (produtoId) => {
    setCarrinho(atual => atual.filter(item => item.id !== produtoId));
  };

  // Alterar quantidade
  const alterarQuantidade = (produtoId, delta) => {
    setCarrinho(atual =>
      atual.map(item =>
        item.id === produtoId
          ? { ...item, quantidade: Math.max(1, item.quantidade + delta) }
          : item
      )
    );
  };

  // === GESTIÓN DE PEDIDOS ===

  // Eliminar pedido
  const eliminarPedido = async (pedidoId) => {
    if (!confirm('¿Está seguro de que desea eliminar este pedido? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/orders/${pedidoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setPedidos(atual => atual.filter(pedido => pedido.id !== pedidoId));
        setMensagem('✅ Pedido eliminado exitosamente.');
      } else {
        const errorData = await response.json();
        setMensagem(`❌ Error: ${errorData.error || 'Error al eliminar pedido.'}`);
      }
    } catch (error) {
      console.error('Error al eliminar pedido:', error);
      setMensagem('❌ Error de conexión. No se pudo eliminar el pedido.');
    }

    setTimeout(() => setMensagem(''), 3000);
  };

  // Cancelar pedido
  const cancelarPedido = async (pedidoId) => {
    if (!confirm('¿Está seguro de que desea cancelar este pedido?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/orders/${pedidoId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setPedidos(atual => atual.map(pedido =>
          pedido.id === pedidoId
            ? data.order
            : pedido
        ));
        setMensagem('✅ Pedido cancelado exitosamente.');
      } else {
        const errorData = await response.json();
        setMensagem(`❌ Error: ${errorData.error || 'Error al cancelar pedido.'}`);
      }
    } catch (error) {
      console.error('Error al cancelar pedido:', error);
      setMensagem('❌ Error de conexión. No se pudo cancelar el pedido.');
    }

    setTimeout(() => setMensagem(''), 3000);
  };

  // Marcar pedido como completado
  const completarPedido = async (pedidoId) => {
    try {
      const response = await fetch(`${API_BASE}/orders/${pedidoId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setPedidos(atual => atual.map(pedido =>
          pedido.id === pedidoId
            ? data.order
            : pedido
        ));
        setMensagem('✅ Pedido marcado como completado.');
      } else {
        const errorData = await response.json();
        setMensagem(`❌ Error: ${errorData.error || 'Error al completar pedido.'}`);
      }
    } catch (error) {
      console.error('Error al completar pedido:', error);
      setMensagem('❌ Error de conexión. No se pudo completar el pedido.');
    }

    setTimeout(() => setMensagem(''), 3000);
  };

  // Reenviar confirmación
  const reenviarConfirmacion = async (pedidoId) => {
    try {
      const response = await fetch(`${API_BASE}/orders/${pedidoId}/resend-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        setMensagem('✅ Confirmación reenviada exitosamente.');
      } else {
        const errorData = await response.json();
        setMensagem(`❌ Error: ${errorData.error || 'Error al reenviar confirmación.'}`);
      }
    } catch (error) {
      console.error('Error al reenviar confirmación:', error);
      setMensagem('❌ Error de conexión al reenviar confirmación.');
    }

    setTimeout(() => setMensagem(''), 3000);
  };

  // Calcular total do carrinho
  const totalCarrinho = carrinho.reduce((total, item) => total + item.preco * item.quantidade, 0);

  // Finalizar compra
  const finalizarCompra = async () => {
    const nome = dadosCompra.nome?.trim() || '';
    const email = dadosCompra.email?.trim() || '';
    const endereco = {
      cep: dadosCompra.cep?.replace(/\D/g, ''),
      logradouro: dadosCompra.logradouro?.trim() || '',
      numero: dadosCompra.numero?.trim() || '',
      complemento: dadosCompra.complemento?.trim() || '',
      bairro: dadosCompra.bairro?.trim() || '',
      cidade: dadosCompra.cidade?.trim() || '',
      estado: dadosCompra.estado?.trim() || ''
    };

    if (!nome || nome.split(' ').length < 2) {
      setErroCheckout('❌ Por favor, insira seu nome completo (nome e sobrenome).');
      return;
    }

    if (!validarEmail(email)) {
      setErroCheckout('❌ Por favor, insira um e-mail válido.');
      return;
    }

    if (!endereco.cep || endereco.cep.length !== 8 || !endereco.logradouro || !endereco.numero || !endereco.bairro || !endereco.cidade || !endereco.estado) {
      setErroCheckout('❌ Por favor, complete o endereço com CEP, rua, número, bairro, cidade e estado.');
      return;
    }

    if (carrinho.length === 0) {
      setErroCheckout('❌ Seu carrinho está vazio.');
      return;
    }

    setProcessandoPagamento(true);
    setErroCheckout('');
    setMensagem('⏳ Processando pagamento...');

    try {
      if (metodoPagamento === 'pix') {
        // Pagamento via Pix
        const qrCode = gerarPixQrUrl(totalCarrinho, PIX_CONFIG);
        let orderId = `PED-${Date.now()}`;

        try {
          const registerResponse = await fetch(`${API_BASE}/register-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cliente: { nome, email, telefone: dadosCompra.telefone, endereco },
              itens: carrinho.map(item => ({
                id: item.id,
                nome: item.nome,
                quantidade: item.quantidade,
                preco: item.preco
              })),
              total: totalCarrinho,
              metodoPagamento: 'pix',
              parcelas: 1,
              chavePix: PIX_CONFIG.chave,
              qrCode
            })
          });

          const registerData = await registerResponse.json();
          if (!registerResponse.ok) {
            throw new Error(registerData.error || 'Não foi possível registrar o pedido.');
          }
          orderId = registerData.orderId || orderId;
        } catch (regError) {
          console.warn('Registro de pedido no servidor falhou:', regError);
        }

        const novoPedido = {
          id: orderId,
          cliente: { nome, email, telefone: dadosCompra.telefone, endereco },
          itens: [...carrinho],
          total: totalCarrinho,
          status: 'Aguardando Pagamento Pix',
          data: new Date().toLocaleString('pt-BR'),
          metodoPagamento: 'pix',
          chavePix: PIX_CONFIG.chave,
          qrCode
        };

        setPedidos(atual => [novoPedido, ...atual]);
        setCarrinho([]);
        setDadosCompra({ nome: '', email: '', telefone: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', notificationType: 'email' });
        setCepError('');
        setMostrarCheckout(false);
        setMensagem('✅ Pedido criado com Pix. Use o QR Code ou chave para pagar.');
        setProcessandoPagamento(false);
      } else {
        // Pagamento via Stripe
        const items = carrinho.map(item => ({
          title: item.nome,
          unit_price: Number(item.preco),
          quantity: Number(item.quantidade),
          picture_url: item.imagem,
          currency_id: 'BRL'
        }));

        const response = await fetch(`${API_BASE}/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            customer_email: email,
            installments: parcelas,
            order: {
              cliente: { nome, email, telefone: dadosCompra.telefone, endereco },
              itens: carrinho.map(item => ({
                id: item.id,
                nome: item.nome,
                quantidade: item.quantidade,
                preco: item.preco
              })),
              total: totalCarrinho,
              parcelas: parcelas
            }
          })
        });

        const responseText = await response.text();
        let responseData = {};
        try {
          responseData = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          console.error('Erro ao parsear JSON:', responseText, parseError);
          throw new Error(`Resposta inválida do servidor: ${responseText}`);
        }

        if (!response.ok) {
          console.error('Stripe session creation failed:', response.status, responseData, responseText);
          
          let serverError = responseData.error || responseData.message || response.statusText || responseText || 'Erro ao criar sessão de checkout';
          
          if (response.status === 405) {
            serverError = '❌ Erro de comunicação com o servidor (405). Verifique se o servidor está rodando e tente novamente.';
          } else if (response.status === 403 || response.status === 401) {
            serverError = '❌ Acesso negado. Verifique a configuração do servidor.';
          } else if (response.status === 500) {
            serverError = `❌ Erro no servidor: ${serverError}`;
          } else if (response.status === 0 || !response.status) {
            serverError = '❌ Não foi possível conectar ao servidor. Verifique se ele está rodando.';
          }
          
          throw new Error(serverError);
        }

        if (!responseData.url) {
          console.error('Stripe session created sem URL:', responseData);
          throw new Error('Sessão Stripe criada, mas a URL de pagamento não foi retornada. Verifique o servidor.');
        }

        const novoPedido = {
          id: responseData.orderId || `PED-${Date.now()}`,
          cliente: { nome, email, telefone: dadosCompra.telefone, endereco },
          itens: [...carrinho],
          total: totalCarrinho,
          status: 'Aguardando Pagamento',
          data: new Date().toLocaleString('pt-BR'),
          stripeSessionId: responseData.sessionId,
          paymentUrl: responseData.url,
          metodoPagamento: 'stripe',
          parcelas: parcelas
        };

        setPedidos(atual => [novoPedido, ...atual]);
        setCarrinho([]);
        setDadosCompra({ nome: '', email: '', telefone: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', notificationType: 'email' });
        setCepError('');
        setMostrarCheckout(false);
        setMensagem('⏳ Pedido criado. Você será redirecionado para o Stripe para concluir o pagamento. O email de confirmação será enviado somente quando o pagamento for concluído.');
        setErroCheckout('');
        setProcessandoPagamento(false);
        setTimeout(() => {
          window.location.href = responseData.url;
        }, 1000);
      }

    } catch (error) {
      console.error('❌ Error:', error);
      let mensagemErro = `❌ Erro: ${error.message}`;
      
      if (error.message.includes('Failed to fetch')) {
        mensagemErro = '❌ Erro de conexão. Verifique se o servidor está rodando em http://localhost:5502';
      } else if (error.message.includes('Method Not Allowed')) {
        mensagemErro = '❌ Erro na requisição. Tente atualizar a página e fazer a compra novamente.';
      }
      
      setErroCheckout(mensagemErro);
      setProcessandoPagamento(false);
    }
  };

  const atualizarStatusPedido = async (sessionId, orderId) => {
    try {
      // Para success, confirmar directamente usando session_id y order_id
      const confirmResponse = await fetch(`${API_BASE}/confirm-stripe-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, order_id: orderId })
      });

      if (confirmResponse.ok) {
        console.log('✅ Pagamento confirmado no servidor');
        const resultData = await confirmResponse.json();
        
        // Actualizar pedido local
        setPedidos(pedidos => pedidos.map(pedido =>
          pedido.id === orderId ? { ...pedido, ...resultData, status: 'Pago' } : pedido
        ));

        setMensagem('✅ Pagamento confirmado com sucesso! O email será enviado em instantes para o endereço informado no checkout.');
      } else {
        const errorData = await confirmResponse.json();
        console.error('Erro ao confirmar:', errorData);

        if (errorData.error && errorData.error.includes('Pago Stripe no confirmado')) {
          setMensagem('⏳ Pagamento ainda não confirmado. Aguarde alguns minutos e clique em Verificar Pagamento novamente. O email será enviado somente após o pagamento aprovado.');
        } else {
          setMensagem(`❌ ${errorData.error || 'Não foi possível confirmar o pagamento no servidor.'}`);
        }
      }
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      setMensagem(`❌ Erro ao confirmar pagamento: ${error.message}`);
    }
  };

  const confirmarPixPedido = async (orderId) => {
    try {
      const response = await fetch(`${API_BASE}/confirm-pix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao confirmar pagamento Pix');
      }

      setPedidos(current => current.map(pedido =>
        pedido.id === orderId ? { ...pedido, ...data } : pedido
      ));
      setMensagem('✅ Pagamento Pix confirmado. Pedido actualizado.');
    } catch (error) {
      console.error('Erro ao confirmar Pix:', error);
      setMensagem(`❌ Não foi possível confirmar o Pix: ${error.message}`);
    }
  };

  // Efeito para verificar retorno do Stripe
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');
    const orderId = urlParams.get('order_id');

    if (paymentStatus === 'success' && sessionId && orderId) {
      atualizarStatusPedido(sessionId, orderId);
    } else if (paymentStatus === 'cancel') {
      setMensagem('❌ Pagamento cancelado. Se desejar, tente novamente ou escolha outro método de pagamento.');
    }
  }, []);

  // Stripe checkout apenas - sem integrações antigas

  // Renderizar produtos
  const renderProdutos = () => {
    return React.createElement('div', { className: 'produtos-grid' },
      produtos.map(produto =>
        React.createElement('div', { key: produto.id, className: 'produto-card' },
          React.createElement('img', {
            src: produto.imagem,
            alt: produto.nome,
            onError: (e) => e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMDAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Q29kaWdvIFBJWPCvdGV4dD48L3N2Zz4='
          }),
          React.createElement('div', { className: 'producto-info' },
            React.createElement('span', { className: 'categoria' }, produto.categoria),
            React.createElement('h3', null, produto.nome),
            React.createElement('p', null, produto.descricao),
            React.createElement('div', { className: 'preco' }, formatarPreco(produto.preco)),
            React.createElement('button', {
              className: 'btn-adicionar',
              onClick: () => adicionarAoCarrinho(produto)
            }, '🛒 Adicionar ao Carrinho')
          )
        )
      )
    );
  };

  // Renderizar carrinho
  const renderCarrinho = () => {
    if (carrinho.length === 0) {
      return React.createElement('div', { className: 'carrinho-vazio' },
        React.createElement('h3', null, 'Seu carrinho está vazio'),
        React.createElement('p', null, 'Adicione alguns perfumes incríveis!'),
        React.createElement('button', {
          className: 'btn-primary',
          onClick: () => setAbaAtiva('produtos')
        }, 'Ver Produtos')
      );
    }

    return React.createElement('div', { className: 'carrinho-content' },
      React.createElement('div', { className: 'carrinho-itens' },
        carrinho.map(item =>
          React.createElement('div', { key: item.id, className: 'carrinho-item' },
            React.createElement('div', { className: 'item-info' },
              React.createElement('h4', null, item.nome),
              React.createElement('p', null, `${formatarPreco(item.preco)} x ${item.quantidade}`)
            ),
            React.createElement('div', { className: 'item-controls' },
              React.createElement('button', {
                onClick: () => alterarQuantidade(item.id, -1)
              }, '-'),
              React.createElement('span', null, item.quantidade),
              React.createElement('button', {
                onClick: () => alterarQuantidade(item.id, 1)
              }, '+'),
              React.createElement('button', {
                className: 'btn-remover',
                onClick: () => removerDoCarrinho(item.id)
              }, '🗑️')
            ),
            React.createElement('div', { className: 'item-total' },
              formatarPreco(item.preco * item.quantidade)
            )
          )
        )
      ),
      React.createElement('div', { className: 'carrinho-resumo' },
        React.createElement('div', { className: 'resumo-total' },
          React.createElement('strong', null, `Total: ${formatarPreco(totalCarrinho)}`)
        ),
        React.createElement('button', {
          className: 'btn-checkout',
          onClick: () => {
            setMostrarCheckout(true);
            setEtapaCheckout('resumo');
          }
        }, 'Finalizar Compra')
      )
    );
  };

  // Renderizar resumo do pedido
  const renderResumoPedido = () => {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'checkout-resumo' },
        React.createElement('h3', null, 'Produtos Selecionados'),
        React.createElement('div', { className: 'resumo-itens' },
          carrinho.map(item =>
            React.createElement('div', { key: item.id, className: 'resumo-item' },
              React.createElement('div', { className: 'item-detalhes' },
                React.createElement('span', { className: 'item-nome' }, item.nome),
                React.createElement('span', { className: 'item-quantidade' }, `x${item.quantidade}`)
              ),
              React.createElement('span', { className: 'item-preco' }, formatarPreco(item.preco * item.quantidade))
            )
          )
        ),
        React.createElement('div', { className: 'resumo-total' },
          React.createElement('strong', null, `Total: ${formatarPreco(totalCarrinho)}`)
        )
      ),
      React.createElement('div', { className: 'checkout-footer' },
        React.createElement('button', {
          className: 'btn-secondary',
          onClick: () => setMostrarCheckout(false)
        }, 'Voltar ao Carrinho'),
        React.createElement('button', {
          className: 'btn-primary',
          onClick: () => setEtapaCheckout('dados')
        }, 'Continuar para Dados de Entrega')
      )
    );
  };

  // Renderizar dados de entrega
  const renderDadosEntrega = () => {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'checkout-form' },
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Nome Completo'),
          React.createElement('input', {
            type: 'text',
            value: dadosCompra.nome,
            onChange: (e) => setDadosCompra({...dadosCompra, nome: e.target.value}),
            placeholder: 'Seu nome completo'
          })
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'E-mail'),
          React.createElement('input', {
            type: 'email',
            value: dadosCompra.email,
            onChange: (e) => setDadosCompra({...dadosCompra, email: e.target.value}),
            placeholder: 'seu@email.com'
          })
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Telefone (opcional - para SMS)'),
          React.createElement('input', {
            type: 'tel',
            value: dadosCompra.telefone,
            onChange: (e) => setDadosCompra({...dadosCompra, telefone: e.target.value}),
            placeholder: '(11) 99999-9999'
          }),
          React.createElement('small', { style: { color: '#666', fontSize: '12px' } }, 
            'Adicione seu telefone para receber confirmações por SMS também'
          )
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Como deseja receber notificações?'),
          React.createElement('div', { style: { display: 'flex', gap: '15px', marginTop: '8px' } },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', cursor: 'pointer' } },
              React.createElement('input', {
                type: 'radio',
                name: 'notificationType',
                value: 'email',
                checked: dadosCompra.notificationType === 'email',
                onChange: (e) => setDadosCompra({...dadosCompra, notificationType: e.target.value})
              }),
              React.createElement('span', { style: { marginLeft: '5px' } }, 'Apenas Email')
            ),
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', cursor: 'pointer' } },
              React.createElement('input', {
                type: 'radio',
                name: 'notificationType',
                value: 'sms',
                checked: dadosCompra.notificationType === 'sms',
                onChange: (e) => setDadosCompra({...dadosCompra, notificationType: e.target.value}),
                disabled: !dadosCompra.telefone
              }),
              React.createElement('span', { style: { marginLeft: '5px' } }, 'Apenas SMS')
            ),
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', cursor: 'pointer' } },
              React.createElement('input', {
                type: 'radio',
                name: 'notificationType',
                value: 'both',
                checked: dadosCompra.notificationType === 'both',
                onChange: (e) => setDadosCompra({...dadosCompra, notificationType: e.target.value}),
                disabled: !dadosCompra.telefone
              }),
              React.createElement('span', { style: { marginLeft: '5px' } }, 'Email + SMS')
            )
          )
        ),
        React.createElement('div', { className: 'form-row' },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'CEP'),
            React.createElement('input', {
              type: 'text',
              value: dadosCompra.cep,
              onChange: (e) => setDadosCompra({...dadosCompra, cep: e.target.value}),
              onBlur: (e) => buscarEnderecoPorCep(e.target.value),
              placeholder: '00000-000',
              maxLength: 9
            }),
            cepError && React.createElement('small', { style: { color: '#dc2626' } }, cepError)
          ),
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Número'),
            React.createElement('input', {
              type: 'text',
              value: dadosCompra.numero,
              onChange: (e) => setDadosCompra({...dadosCompra, numero: e.target.value}),
              placeholder: 'Número'
            })
          )
        ),
        React.createElement('div', { className: 'form-row' },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Rua'),
            React.createElement('input', {
              type: 'text',
              value: dadosCompra.logradouro,
              onChange: (e) => setDadosCompra({...dadosCompra, logradouro: e.target.value}),
              placeholder: 'Rua, avenida, travessa'
            })
          ),
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Complemento'),
            React.createElement('input', {
              type: 'text',
              value: dadosCompra.complemento,
              onChange: (e) => setDadosCompra({...dadosCompra, complemento: e.target.value}),
              placeholder: 'Apto, bloco, casa'
            })
          )
        ),
        React.createElement('div', { className: 'form-row' },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Bairro'),
            React.createElement('input', {
              type: 'text',
              value: dadosCompra.bairro,
              onChange: (e) => setDadosCompra({...dadosCompra, bairro: e.target.value}),
              placeholder: 'Bairro'
            })
          ),
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Cidade / Estado'),
            React.createElement('div', { style: { display: 'flex', gap: '1rem' } },
              React.createElement('input', {
                type: 'text',
                value: dadosCompra.cidade,
                onChange: (e) => setDadosCompra({...dadosCompra, cidade: e.target.value}),
                placeholder: 'Cidade'
              }),
              React.createElement('input', {
                type: 'text',
                value: dadosCompra.estado,
                onChange: (e) => setDadosCompra({...dadosCompra, estado: e.target.value}),
                placeholder: 'UF',
                maxLength: 2,
                style: { maxWidth: '80px' }
              })
            )
          )
        )
      ),
      erroCheckout && React.createElement('div', { className: 'mensagem erro' }, erroCheckout),
      React.createElement('div', { className: 'checkout-footer' },
        React.createElement('button', {
          className: 'btn-secondary',
          onClick: () => setEtapaCheckout('resumo')
        }, 'Voltar ao Resumo'),
        React.createElement('button', {
          className: 'btn-primary',
          onClick: () => {
            const nome = dadosCompra.nome?.trim() || '';
            const email = dadosCompra.email?.trim() || '';
            const endereco = {
              cep: dadosCompra.cep?.replace(/\D/g, ''),
              logradouro: dadosCompra.logradouro?.trim() || '',
              numero: dadosCompra.numero?.trim() || '',
              complemento: dadosCompra.complemento?.trim() || '',
              bairro: dadosCompra.bairro?.trim() || '',
              cidade: dadosCompra.cidade?.trim() || '',
              estado: dadosCompra.estado?.trim() || ''
            };

            if (!nome || nome.split(' ').length < 2) {
              setErroCheckout('❌ Por favor, insira seu nome completo (nome e sobrenome).');
              return;
            }

            if (!validarEmail(email)) {
              setErroCheckout('❌ Por favor, insira um e-mail válido.');
              return;
            }

            if (!endereco.cep || endereco.cep.length !== 8 || !endereco.logradouro || !endereco.numero || !endereco.bairro || !endereco.cidade || !endereco.estado) {
              setErroCheckout('❌ Por favor, complete o endereço com CEP, rua, número, bairro, cidade e estado.');
              return;
            }

            setErroCheckout('');
            setEtapaCheckout('pagamento');
          }
        }, 'Continuar para Pagamento')
      )
    );
  };

  // Renderizar método de pagamento
  const renderMetodoPagamento = () => {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'pix-section' },
        React.createElement('h3', null, 'Escolha o Método de Pagamento'),
        React.createElement('div', { className: 'pix-option' },
          React.createElement('label', null,
            React.createElement('input', {
              type: 'radio',
              name: 'metodoPagamento',
              value: 'pix',
              checked: metodoPagamento === 'pix',
              onChange: (e) => setMetodoPagamento(e.target.value)
            }),
            ' Pagamento via Pix'
          ),
          metodoPagamento === 'pix' && React.createElement('div', { className: 'pix-details' },
            React.createElement('p', null, 'Escaneie o QR Code ou copie a chave Pix para realizar o pagamento.'),
            React.createElement('div', { className: 'pix-qr' },
              React.createElement('img', {
                src: gerarPixQrUrl(totalCarrinho, PIX_CONFIG),
                alt: 'QR Code Pix',
                className: 'qr-image'
              })
            ),
            React.createElement('div', { className: 'pix-copy' },
              React.createElement('input', {
                type: 'text',
                value: PIX_CONFIG.chave,
                readOnly: true,
                className: 'codigo-pix-texto'
              }),
              React.createElement('button', {
                className: 'btn-copiar',
                onClick: () => navigator.clipboard.writeText(PIX_CONFIG.chave)
              }, 'Copiar')
            )
          )
        ),
        React.createElement('div', { className: 'pix-option' },
          React.createElement('label', null,
            React.createElement('input', {
              type: 'radio',
              name: 'metodoPagamento',
              value: 'stripe',
              checked: metodoPagamento === 'stripe',
              onChange: (e) => setMetodoPagamento(e.target.value)
            }),
            ' Outros pagamentos via Stripe (Cartão, Boleto, Apple Pay, Google Pay, etc.)'
          ),
          metodoPagamento === 'stripe' && React.createElement('div', { className: 'installments-section' },
            React.createElement('h4', null, 'Pagamento via Stripe'),
            React.createElement('p', null, 'Você será redirecionado para a plataforma de pagamentos Stripe para concluir o pedido.'),
            totalCarrinho > 100 ?
              React.createElement(React.Fragment, null,
                React.createElement('p', null, 'Selecione o número de parcelas desejado:'),
                [1, 2, 3, 4, 5, 6].map(num =>
                  React.createElement('div', { key: num, className: 'installments-option' },
                    React.createElement('input', {
                      type: 'radio',
                      name: 'parcelas',
                      value: num,
                      checked: parcelas === num,
                      onChange: (e) => setParcelas(Number(e.target.value))
                    }),
                    React.createElement('div', { className: 'installments-details' },
                      React.createElement('h5', null, `${num}x de ${formatarPreco(totalCarrinho / num)}`),
                      num > 1 && React.createElement('p', null, `Total: ${formatarPreco(totalCarrinho)}`)
                    )
                  )
                )
              ) :
              React.createElement('p', null, 'O pagamento será processado em 1x via Stripe.')
          )
        )
      ),
      erroCheckout && React.createElement('div', { className: 'mensagem erro' }, erroCheckout),
      React.createElement('div', { className: 'checkout-resumo' },
        React.createElement('h3', null, 'Resumo do Pedido'),
        React.createElement('div', { className: 'resumo-itens' },
          carrinho.map(item =>
            React.createElement('div', { key: item.id, className: 'resumo-item' },
              `${item.nome} x${item.quantidade} - ${formatarPreco(item.preco * item.quantidade)}`
            )
          )
        ),
        React.createElement('div', { className: 'resumo-total' },
          `Total: ${formatarPreco(totalCarrinho)}`
        )
      ),
      React.createElement('div', { className: 'checkout-footer' },
        React.createElement('button', {
          className: 'btn-secondary',
          onClick: () => setEtapaCheckout('dados')
        }, 'Voltar aos Dados'),
        React.createElement('button', {
          className: 'btn-primary',
          onClick: finalizarCompra,
          disabled: processandoPagamento
        }, processandoPagamento ? 'Processando...' : 'Confirmar Compra')
      )
    );
  };

  // Renderizar checkout
  const renderCheckout = () => {
    const titulo = etapaCheckout === 'resumo' ? 'Resumo do Pedido' :
                   etapaCheckout === 'dados' ? 'Dados de Entrega' : 'Método de Pagamento';

    return React.createElement('div', { className: 'checkout-overlay' },
      React.createElement('div', { className: 'checkout-modal' },
        React.createElement('div', { className: 'checkout-header' },
          React.createElement('h2', null, titulo),
          React.createElement('button', {
            className: 'btn-close',
            onClick: () => {
              setMostrarCheckout(false);
              setCepError('');
              setEtapaCheckout('resumo');
            }
          }, '✕')
        ),
        React.createElement('div', { className: 'checkout-body' },
          etapaCheckout === 'resumo' ? renderResumoPedido() :
          etapaCheckout === 'dados' ? renderDadosEntrega() :
          renderMetodoPagamento()
        )
      )
    );
  };

  // Renderizar pedidos
  const renderPedidos = () => {
    if (pedidos.length === 0) {
      return React.createElement('div', { className: 'pedidos-vazio' },
        React.createElement('h3', null, 'Nenhum pedido ainda'),
        React.createElement('p', null, 'Faça sua primeira compra!'),
        React.createElement('button', {
          className: 'btn-primary',
          onClick: () => setAbaAtiva('produtos')
        }, 'Ver Produtos')
      );
    }

    return React.createElement('div', { className: 'pedidos-lista' },
      pedidos.map(pedido =>
        React.createElement('div', { key: pedido.id, className: 'pedido-card' },
          React.createElement('div', { className: 'pedido-header' },
            React.createElement('h3', null, `Pedido ${pedido.id}`),
            React.createElement('span', { className: `status ${pedido.status.toLowerCase().replace(/ /g, '-')}` },
              pedido.status
            )
          ),
          React.createElement('div', { className: 'pedido-info' },
            React.createElement('p', null, `Cliente: ${pedido.cliente.nome}`),
            React.createElement('p', null, `Email: ${pedido.cliente.email}`),
            React.createElement('p', null, `Data: ${pedido.data}`),
            React.createElement('p', null, `Método de Pagamento: ${pedido.metodoPagamento === 'pix' ? 'Pix' : `Stripe (${pedido.parcelas || 1}x)`}`)
          ),
          React.createElement('div', { className: 'pedido-itens' },
            pedido.itens.map(item =>
              React.createElement('div', { key: item.id, className: 'pedido-item' },
                `${item.nome} x${item.quantidade} - ${formatarPreco(item.preco * item.quantidade)}`
              )
            )
          ),
          pedido.metodoPagamento === 'pix' && React.createElement('div', { className: 'qr-code' },
            React.createElement('h4', null, 'Pagamento via Pix'),
            React.createElement('div', { className: 'qr-container' },
              React.createElement('img', {
                src: pedido.qrCode,
                alt: 'QR Code Pix',
                className: 'qr-image'
              })
            ),
            React.createElement('div', { className: 'codigo-pix' },
              React.createElement('small', null, 'Chave Pix:'),
              React.createElement('div', { className: 'codigo-pix-texto' }, pedido.chavePix),
              React.createElement('button', {
                className: 'btn-copiar',
                onClick: () => navigator.clipboard.writeText(pedido.chavePix)
              }, 'Copiar Chave')
            ),
            React.createElement('div', { className: 'nota-importante' },
              React.createElement('p', null, 'Após realizar o pagamento, o status será atualizado automaticamente.')
            )
          ),
          React.createElement('div', { className: 'pedido-total' },
            `Total: ${formatarPreco(pedido.total)}`
          ),
          pedido.status && pedido.status.toLowerCase().includes('aguardando') && React.createElement('div', { className: 'pedido-actions', style: { marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' } },
            pedido.paymentUrl && React.createElement('a', {
              href: pedido.paymentUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'btn-primary',
              style: { display: 'inline-flex', alignItems: 'center' }
            }, 'Retomar Checkout Stripe'),
            pedido.stripeSessionId && React.createElement('button', {
              className: 'btn-secondary',
              onClick: () => atualizarStatusPedido(pedido.stripeSessionId, pedido.id)
            }, 'Verificar Pagamento'),
            pedido.metodoPagamento === 'pix' && React.createElement('button', {
              className: 'btn-primary',
              onClick: () => confirmarPixPedido(pedido.id)
            }, 'Confirmar Pix')
          ),
          pedido.status && pedido.status.toLowerCase().includes('pago') && React.createElement('div', { className: 'pedido-actions', style: { marginTop: '1rem' } },
            React.createElement('button', {
              className: 'btn-secondary',
              onClick: () => verEtiqueta(pedido.id)
            }, 'Ver Etiqueta A6')
          ),
          // === MENÚ DE GESTIÓN DE PEDIDOS ===
          React.createElement('div', { className: 'pedido-gestion', style: { marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' } },
            React.createElement('h4', { style: { margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#495057' } }, 'Gestión del Pedido'),
            React.createElement('div', { style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' } },
              // Botón Cancelar (solo si no está cancelado, completado o pagado)
              !pedido.status.toLowerCase().includes('cancelado') &&
              !pedido.status.toLowerCase().includes('completado') &&
              !pedido.status.toLowerCase().includes('pago') &&
              React.createElement('button', {
                className: 'btn-danger',
                onClick: () => cancelarPedido(pedido.id),
                style: { background: '#dc3545', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }
              }, 'Cancelar Pedido'),

              // Botón Completar (solo si está pagado)
              pedido.status.toLowerCase().includes('pago') &&
              !pedido.status.toLowerCase().includes('completado') &&
              React.createElement('button', {
                className: 'btn-success',
                onClick: () => completarPedido(pedido.id),
                style: { background: '#28a745', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }
              }, 'Marcar Completado'),

              // Botón Reenviar Confirmación (solo si está pagado)
              pedido.status.toLowerCase().includes('pago') &&
              React.createElement('button', {
                className: 'btn-info',
                onClick: () => reenviarConfirmacion(pedido.id),
                style: { background: '#17a2b8', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }
              }, 'Reenviar Confirmación'),

              // Botón Eliminar (siempre disponible)
              React.createElement('button', {
                className: 'btn-outline-danger',
                onClick: () => eliminarPedido(pedido.id),
                style: { background: 'transparent', color: '#dc3545', border: '1px solid #dc3545', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }
              }, 'Eliminar Pedido')
            )
          )
        )
      )
    );
  };

  // Render principal
  return React.createElement('div', { className: `app ${mostrarCheckout ? 'checkout-open' : ''}` },
    // Header
    React.createElement('header', { className: 'header' },
      React.createElement('div', { className: 'brand' },
        React.createElement('div', { className: 'brand-mark' }, 'PG'),
        React.createElement('div', { className: 'brand-title' },
          React.createElement('h1', null, 'Perfume Glamour'),
          React.createElement('p', null, 'Perfumes exclusivos com entrega rápida')
        )
      ),
      React.createElement('nav', { className: 'nav' },
        React.createElement('button', {
          className: `nav-btn ${abaAtiva === 'produtos' ? 'active' : ''}`,
          onClick: () => setAbaAtiva('produtos')
        }, 'Produtos'),
        React.createElement('button', {
          className: `nav-btn ${abaAtiva === 'carrinho' ? 'active' : ''}`,
          onClick: () => setAbaAtiva('carrinho')
        }, `Carrinho (${carrinho.length})`),
        React.createElement('button', {
          className: `nav-btn ${abaAtiva === 'pedidos' ? 'active' : ''}`,
          onClick: () => setAbaAtiva('pedidos')
        }, 'Meus Pedidos')
      )
    ),

    // Mensagem
    mensagem && React.createElement('div', { className: `mensagem ${mensagem.includes('❌') ? 'erro' : 'sucesso'}` },
      mensagem
    ),

    // Conteúdo principal
    React.createElement('main', { className: 'main' },
      abaAtiva === 'produtos' && renderProdutos(),
      abaAtiva === 'carrinho' && renderCarrinho(),
      abaAtiva === 'pedidos' && renderPedidos()
    ),

    // Modal de checkout
    mostrarCheckout && renderCheckout(),

    // Footer
    React.createElement('footer', { className: 'footer' },
      React.createElement('p', null, '© 2024 Perfume Glamour - Todos os direitos reservados')
    )
  );
}

// Renderizar aplicação
console.log('Renderizando aplicação...');

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
  console.log('✅ Aplicação React renderizada com sucesso!');
} catch (error) {
  console.error('❌ Erro ao renderizar React:', error);
  document.getElementById('root').innerHTML = `
    <div style="text-align: center; padding: 50px; color: red;">
      <h2>Erro ao carregar a aplicação React</h2>
      <p>Verifique o console do navegador para mais detalhes.</p>
      <p><a href="index-offline.html" style="color: blue;">Tente a versão offline</a></p>
    </div>
  `;
}
