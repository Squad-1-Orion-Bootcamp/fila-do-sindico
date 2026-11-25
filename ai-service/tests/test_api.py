from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    resposta = client.get("/health")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_classifica_vazamento_como_alta():
    resposta = client.post("/classificar", json={"descricao": "Cano vazando na garagem"})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["urgencia"] == "alta"
    assert corpo["categoria"] == "hidraulica"
    assert corpo["justificativa"]


def test_descricao_vazia_e_rejeitada():
    resposta = client.post("/classificar", json={"descricao": ""})
    assert resposta.status_code == 422


def test_classifica_palavra_de_risco_sem_acento_como_urgente():
    resposta = client.post("/classificar", json={"descricao": "Cheiro forte de gas na cozinha"})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["urgencia"] == "urgente"
    assert corpo["categoria"] == "seguranca"
    assert corpo["justificativa"] == "Trava de risco: a descrição menciona 'gás'."


def test_classifica_vazamento_grave_como_urgente():
    resposta = client.post("/classificar", json={"descricao": "Vazamento grave na garagem"})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["urgencia"] == "urgente"
    assert corpo["categoria"] == "hidraulica"
    assert corpo["justificativa"] == "Trava de risco: a descrição menciona 'vazamento grave'."


def test_classifica_lampada_como_normal():
    resposta = client.post("/classificar", json={"descricao": "Lâmpada queimada no 2º andar"})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["urgencia"] == "normal"
    assert corpo["categoria"] == "eletrica"


def test_classifica_sem_palavra_chave_como_normal():
    resposta = client.post("/classificar", json={"descricao": "Pintura descascando na recepção"})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["urgencia"] == "normal"
    assert corpo["categoria"] == "outros"
