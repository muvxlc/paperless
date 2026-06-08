<template>
  <div>
    <Html lang="th">
      <Head>
        <Title>Paperless Manager</Title>
        <Link rel="preconnect" href="https://fonts.googleapis.com" />
        <Link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <Link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <Style>
          body {
            font-family: 'IBM Plex Sans Thai', sans-serif;
          }
        </Style>
      </Head>
    </Html>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <UModals />
    <UNotifications />
  </div>
</template>
