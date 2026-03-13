const fs = require('fs');
const path = require('path');

// Create directories
const dirs = [
  path.join(__dirname, 'frontend', 'e2e'),
  path.join(__dirname, 'frontend', 'src', 'components', '__tests__')
];

console.log('Creating test directories...\n');

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('✓ Created directory:', dir);
  } else {
    console.log('✓ Directory already exists:', dir);
  }
});

// Create component test files
const componentTests = {
  'SessionSetup.test.js': `import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SessionSetup from '../SessionSetup.vue'

// Mock useSession
const mockSetSessionName = vi.fn()
vi.mock('@/composables/useSession', () => ({
  useSession: () => ({
    setSessionName: mockSetSessionName
  })
}))

describe('SessionSetup.vue', () => {
  beforeEach(() => {
    mockSetSessionName.mockClear()
  })

  it('renders correctly', () => {
    const wrapper = mount(SessionSetup)
    
    expect(wrapper.find('.session-overlay').exists()).toBe(true)
    expect(wrapper.find('.session-modal').exists()).toBe(true)
    expect(wrapper.find('h2').text()).toContain('Willkommen')
  })

  it('shows input field and button', () => {
    const wrapper = mount(SessionSetup)
    
    expect(wrapper.find('.session-input').exists()).toBe(true)
    expect(wrapper.find('.session-btn').exists()).toBe(true)
  })

  it('button is disabled when input is empty', () => {
    const wrapper = mount(SessionSetup)
    
    const button = wrapper.find('.session-btn')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('button is enabled when input has value', async () => {
    const wrapper = mount(SessionSetup)
    
    await wrapper.find('.session-input').setValue('TestUser')
    
    const button = wrapper.find('.session-btn')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('button is disabled when input has only whitespace', async () => {
    const wrapper = mount(SessionSetup)
    
    await wrapper.find('.session-input').setValue('   ')
    
    const button = wrapper.find('.session-btn')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('calls setSessionName when form is submitted', async () => {
    const wrapper = mount(SessionSetup)
    
    await wrapper.find('.session-input').setValue('TestUser')
    await wrapper.find('.session-btn').trigger('click')
    
    expect(mockSetSessionName).toHaveBeenCalledWith('TestUser')
  })

  it('trims whitespace before setting session name', async () => {
    const wrapper = mount(SessionSetup)
    
    await wrapper.find('.session-input').setValue('  TestUser  ')
    await wrapper.find('.session-btn').trigger('click')
    
    expect(mockSetSessionName).toHaveBeenCalledWith('TestUser')
  })

  it('submits on Enter key press', async () => {
    const wrapper = mount(SessionSetup)
    
    const input = wrapper.find('.session-input')
    await input.setValue('EnterUser')
    await input.trigger('keyup.enter')
    
    expect(mockSetSessionName).toHaveBeenCalledWith('EnterUser')
  })

  it('does not submit on Enter with empty input', async () => {
    const wrapper = mount(SessionSetup)
    
    const input = wrapper.find('.session-input')
    await input.trigger('keyup.enter')
    
    expect(mockSetSessionName).not.toHaveBeenCalled()
  })

  it('has autofocus on input', () => {
    const wrapper = mount(SessionSetup)
    
    const input = wrapper.find('.session-input')
    expect(input.attributes('autofocus')).toBeDefined()
  })

  it('has maxlength of 30 on input', () => {
    const wrapper = mount(SessionSetup)
    
    const input = wrapper.find('.session-input')
    expect(input.attributes('maxlength')).toBe('30')
  })

  it('displays correct icon', () => {
    const wrapper = mount(SessionSetup)
    
    expect(wrapper.find('.session-icon').text()).toBe('🛒')
  })

  it('has correct placeholder text', () => {
    const wrapper = mount(SessionSetup)
    
    const input = wrapper.find('.session-input')
    expect(input.attributes('placeholder')).toBe('Dein Name...')
  })
})
`
};

console.log('\nCreating component test files...');
const componentTestDir = path.join(__dirname, 'frontend', 'src', 'components', '__tests__');

for (const [filename, content] of Object.entries(componentTests)) {
  const filepath = path.join(componentTestDir, filename);
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(\`✓ Created: \${filename}\`);
}

console.log('\n✓ All directories and component tests created successfully!');
