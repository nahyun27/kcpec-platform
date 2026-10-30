// 구조화 데이터(JSON-LD) 출력. "<" 를 이스케이프해 내용 안의 </script> 로 태그가 깨지지 않게 한다.
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
