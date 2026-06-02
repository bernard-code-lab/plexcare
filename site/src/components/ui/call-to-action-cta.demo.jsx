import { CtaCard } from '@/components/ui/call-to-action-cta'

const CtaCardDemo = () => {
  const handleSignUp = (email) => {
    alert(`Thank you for signing up with ${email}!`)
  }

  return (
    <div className="w-full p-4 md:p-8">
      <CtaCard
        title="Let's build from here"
        description="Harnessed for productivity. Designed for collaboration. Celebrated for built-in security. Welcome to the platform developers love."
        buttonText="Sign up for GitHub"
        inputPlaceholder="Email address"
        imageSrc="https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=1600&auto=format&fit=crop"
        onButtonClick={handleSignUp}
      />
    </div>
  )
}

export default CtaCardDemo
