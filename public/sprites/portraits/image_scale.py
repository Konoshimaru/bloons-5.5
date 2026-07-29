import os
from PIL import Image

def scale_sprites_by_padding(min_padding_threshold=4):
    """
    Verifica se existe um espaço vazio (Alpha <= 5) em todos os 4 lados do sprite.
    Se existir, faz um crop simétrico e redimensiona de volta para o tamanho original,
    fazendo com que o conteúdo ocupe o espaço vazio de forma uniforme e centralizada.
    """
    pasta_atual = os.getcwd()
    pasta_output = os.path.join(pasta_atual, "sprites_redimensionados")
    
    if not os.path.exists(pasta_output):
        os.makedirs(pasta_output)
        
    print(f"A analisar originais de: {pasta_atual}")
    print(f"A exportar cópias seguras para: {pasta_output}\n")

    count = 0
    for nome_ficheiro in os.listdir(pasta_atual):
        if nome_ficheiro.lower().endswith('.png') and nome_ficheiro != 'scale_sprites.py':
            caminho_original = os.path.join(pasta_atual, nome_ficheiro)
            caminho_novo = os.path.join(pasta_output, nome_ficheiro)
            
            try:
                with Image.open(caminho_original) as img:
                    if img.mode != 'RGBA':
                        img = img.convert('RGBA')
                    
                    orig_w, orig_h = img.size
                    pixels = img.load()
                    
                    # 1. Calcular o espaço vazio em cada uma das 4 direções
                    # Cima (Top)
                    pad_top = 0
                    for y in range(orig_h):
                        if any(pixels[x, y][3] > 5 for x in range(orig_w)):
                            break
                        pad_top += 1
                        
                    # Baixo (Bottom)
                    pad_bottom = 0
                    for y in range(orig_h - 1, -1, -1):
                        if any(pixels[x, y][3] > 5 for x in range(orig_w)):
                            break
                        pad_bottom += 1
                        
                    # Esquerda (Left)
                    pad_left = 0
                    for x in range(orig_w):
                        if any(pixels[x, y][3] > 5 for y in range(orig_h)):
                            break
                        pad_left += 1
                        
                    # Direita (Right)
                    pad_right = 0
                    for x in range(orig_w - 1, -1, -1):
                        if any(pixels[x, y][3] > 5 for y in range(orig_h)):
                            break
                        pad_right += 1
                    
                    # 2. Encontrar a margem mínima comum disponível em TODOS os lados
                    min_available_padding = min(pad_top, pad_bottom, pad_left, pad_right)
                    
                    # Só avança se a margem encontrada for maior ou igual ao limite definido (ex: 4 píxeis)
                    if min_available_padding < min_padding_threshold:
                        print(f"⚠ Ignorado: {nome_ficheiro} (Espaço livre insuficiente em algum dos lados: T:{pad_top}, B:{pad_bottom}, L:{pad_left}, R:{pad_right})")
                        # Salva uma cópia direta para a pasta de output para manter o set completo
                        img.save(caminho_novo)
                        continue
                    
                    # 3. Recortar a imagem simetricamente usando o valor mínimo
                    # Isto garante que removemos a mesma quantidade de espaço em todo o lado, mantendo o centro visual original intacto!
                    box = (
                        min_available_padding,                   # Esquerda
                        min_available_padding,                   # Cima
                        orig_w - min_available_padding,          # Direita
                        orig_h - min_available_padding           # Baixo
                    )
                    cropped_img = img.crop(box)
                    
                    # 4. Redimensionar (esticar) o recorte de volta para as dimensões originais da imagem
                    # Usamos Resampling.LANCZOS para manter a máxima qualidade dos píxeis do macaco
                    scaled_img = cropped_img.resize((orig_w, orig_h), Image.Resampling.LANCZOS)
                    
                    # Salva na pasta segura
                    scaled_img.save(caminho_novo, "PNG")
                    print(f"✓ Redimensionado: {nome_ficheiro} (Removidos {min_available_padding}px de margem em todos os lados)")
                    count += 1
                    
            except Exception as e:
                print(f"✕ Erro ao processar {nome_ficheiro}: {e}")
                
    print(f"\nConcluído! {count} imagens foram otimizadas e salvas em: {pasta_output}")

if __name__ == "__main__":
    # Podes alterar o valor aqui. Se definires 4, ele só mexe na imagem se ela tiver pelo menos 4px vazios em CIMA, BAIXO, ESQUERDA e DIREITA.
    scale_sprites_by_padding(min_padding_threshold=4)
